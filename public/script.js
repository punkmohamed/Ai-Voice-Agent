document.addEventListener('DOMContentLoaded', () => {
	// UI Elements
	const startButton = document.getElementById('startConversation');
	const statusDiv = document.getElementById('status');
	const conversationDiv = document.getElementById('conversation');
	const mainContainer = document.getElementById('mainContainer');
	const logTableBody = document.getElementById('logTableBody');
	const micStatus = document.getElementById('micStatus');
	const micStatusDot = micStatus.querySelector('div');
	const micStatusText = micStatus.querySelector('span');

	// WebRTC variables
	let peerConnection;
	let dataChannel;

	// Update microphone status
	function updateMicStatus(isActive, statusText) {
		micStatusDot.className = `w-3 h-3 rounded-full ${isActive ? 'bg-green-500 animate-pulse-custom' : 'bg-gray-300'}`;
		micStatusText.textContent = statusText;
		micStatusText.className = `text-sm ${isActive ? 'text-green-500' : 'text-gray-500'}`;
	}

	// Add message to log
	function addToLog(type, message) {
		if (!message || message.trim() === '') return;
		
		const row = document.createElement('tr');
		row.className = 'border-b hover:bg-gray-50 transition-colors duration-200';
		
		const time = new Date().toLocaleTimeString();
		const typeClass = type === 'User' ? 'text-blue-600' : 'text-green-600';
		
		row.innerHTML = `
			<td class="p-2">${time}</td>
			<td class="p-2"><span class="${typeClass} font-medium">${type}</span></td>
			<td class="p-2">${message}</td>
		`;
		
		logTableBody.appendChild(row);
		row.scrollIntoView({ behavior: 'smooth', block: 'end' });
	}

	// Create a message element to add to the conversation
	function addMessage(text, isUser = false) {
		if (!text || text.trim() === '') return;
		
		const messageEl = document.createElement('div');
		messageEl.className = isUser
			? 'message-bubble user-message bg-blue-100 p-3 rounded-lg ml-auto max-w-[80%] mb-4 shadow-sm'
			: 'message-bubble ai-message bg-gray-100 p-3 rounded-lg max-w-[80%] mb-4 shadow-sm';
		
		const iconEl = document.createElement('i');
		iconEl.className = isUser 
			? 'fas fa-user text-blue-500 mb-2' 
			: 'fas fa-robot text-gray-500 mb-2';
		
		const textEl = document.createElement('div');
		textEl.className = 'mt-1';
		textEl.textContent = text;
		
		messageEl.appendChild(iconEl);
		messageEl.appendChild(textEl);
		conversationDiv.appendChild(messageEl);
		
		// Smooth scroll to bottom
		messageEl.scrollIntoView({ behavior: 'smooth', block: 'end' });
	}

	// Initialize WebRTC connection
	function initializeConnection() {
		updateMicStatus(false, 'Connecting...');
		startButton.disabled = true;
		startButton.classList.add('opacity-50');

		// Create a WebRTC connection
		peerConnection = new RTCPeerConnection();

		// On inbound audio add to page
		peerConnection.ontrack = (event) => {
			const el = document.createElement('audio');
			el.srcObject = event.streams[0];
			el.autoplay = true;
			el.controls = true;
			el.className = 'mt-4 w-full';
			conversationDiv.appendChild(el);
		};

		dataChannel = peerConnection.createDataChannel('oai-events');

		// Configure the data channel
		dataChannel.addEventListener('open', () => {
			console.log('Data channel opened');
			const event = {
				type: 'session.update',
				session: {
					modalities: ['text', 'audio']
				}
			};
			dataChannel.send(JSON.stringify(event));
			statusDiv.textContent = 'Connected! You can speak now.';
			updateMicStatus(true, 'Microphone active');
			startButton.innerHTML = '<i class="fas fa-check-circle"></i><span>Connected</span>';
			const greeting = 'Hello! How can I help you today?';
			addMessage(greeting, false);
			addToLog('AI', greeting);
		});

		// Variables to track conversation state
		let currentResponseId = null;
		let currentMessageElement = null;
		let accumulatedResponse = '';
		let lastUserMessage = ''; // Track last user message to avoid duplicates

		// Clear any previous conversation
		conversationDiv.innerHTML = '';
		logTableBody.innerHTML = '';

		// Handle incoming messages
		dataChannel.addEventListener('message', (event) => {
			const msg = JSON.parse(event.data);
			console.log('Received message:', msg);

			// Handle text responses
			if (msg.type === 'response.text.delta') {
				// Show visual indicator that AI is responding
				statusDiv.textContent = 'AI is responding...';
				statusDiv.className = 'mt-4 text-sm text-green-500 font-medium';

				// Check if this is a new response
				if (currentResponseId !== msg.response_id) {
					currentResponseId = msg.response_id;
					currentMessageElement = document.createElement('div');
					currentMessageElement.className = 'bg-gray-100 p-3 rounded-lg max-w-[80%] mb-2';
					conversationDiv.appendChild(currentMessageElement);
					accumulatedResponse = '';
				}

				// Add the text to the current message
				if (msg.delta && msg.delta.text) {
					accumulatedResponse += msg.delta.text;
					currentMessageElement.textContent = accumulatedResponse;
					conversationDiv.scrollTop = conversationDiv.scrollHeight;
				}
			}

			// Handle completed output items (including audio transcripts)
			if (msg.type === 'response.output_item.done') {
				if (msg.item && msg.item.content && msg.item.content.length > 0) {
					for (const content of msg.item.content) {
						if (content.transcript) {
							// Add AI's message to conversation and log
							addMessage(content.transcript, false);
							addToLog('AI', content.transcript);
						}
					}
				}
			}

			// Handle user transcript (what the user said)
			if (msg.type === 'transcript.partial' || msg.type === 'transcript.complete') {
				if (msg.transcript && msg.transcript.text) {
					const userText = msg.transcript.text;
					
					// Show visual indicator that microphone is active
					if (msg.type === 'transcript.partial') {
						statusDiv.textContent = 'Listening...';
						statusDiv.className = 'mt-4 text-sm text-blue-500 font-medium animate-pulse';
						updateMicStatus(true, 'Listening...');
						
						// Update existing message or create new one for partial
						const userMessageId = `user-${msg.transcript_id}`;
						let userMessage = document.getElementById(userMessageId);

						if (!userMessage) {
							userMessage = document.createElement('div');
							userMessage.id = userMessageId;
							userMessage.className = 'message-bubble user-message bg-blue-100 p-3 rounded-lg ml-auto max-w-[80%] mb-4 shadow-sm';
							conversationDiv.appendChild(userMessage);
						}

						userMessage.textContent = userText;
						conversationDiv.scrollTop = conversationDiv.scrollHeight;
					} else if (msg.type === 'transcript.complete') {
						statusDiv.textContent = 'Connected! You can speak now.';
						statusDiv.className = 'mt-4 text-sm text-gray-500 font-medium';
						updateMicStatus(true, 'Microphone active');
						
						// Only log if it's a new message (avoid duplicates)
						if (userText !== lastUserMessage) {
							addMessage(userText, true);
							addToLog('User', userText);
							lastUserMessage = userText;
						}
					}
				}
			}
		});

		// Capture microphone
		navigator.mediaDevices.getUserMedia({ audio: true })
			.then((stream) => {
				// Add microphone to PeerConnection
				stream.getTracks().forEach((track) => {
					peerConnection.addTransceiver(track, { direction: 'sendrecv' });
				});

				// Create and send offer
				peerConnection.createOffer()
					.then((offer) => {
						peerConnection.setLocalDescription(offer);

						// Get session token
						fetch('/session')
							.then((response) => response.json())
							.then((data) => {
								console.log('Session data:', data);

								// Check if the data has the expected structure
								if (!data.result || !data.result.client_secret || !data.result.client_secret.value) {
									throw new Error('Invalid session data structure');
								}

								const EPHEMERAL_KEY = data.result.client_secret.value;
								const baseUrl = 'https://api.openai.com/v1/realtime';
								const model = 'gpt-4o-realtime-preview-2024-12-17';

								// Send offer to OpenAI
								fetch(`${baseUrl}?model=${model}`, {
									method: 'POST',
									body: offer.sdp,
									headers: {
										Authorization: `Bearer ${EPHEMERAL_KEY}`,
										'Content-Type': 'application/sdp',
									},
								})
								.then((r) => r.text())
								.then((answer) => {
									// Check if we got a valid SDP answer
									if (!answer || !answer.trim().startsWith('v=')) {
										console.error('Invalid SDP answer received:', answer);
										throw new Error('Invalid SDP answer from OpenAI');
									}

									// Set remote description
									peerConnection.setRemoteDescription({
										sdp: answer,
										type: 'answer',
									});
								})
								.catch(error => {
									console.error('Error connecting to OpenAI:', error);
									updateMicStatus(false, 'Connection error');
									statusDiv.textContent = 'Error: Could not establish connection';
									statusDiv.className = 'mt-4 text-sm text-red-500 font-medium';
									// Re-enable the button so user can try again
									startButton.disabled = false;
									startButton.classList.remove('opacity-50');
									startButton.classList.add('bg-blue-500', 'hover:bg-blue-600');
								});
							})
							.catch(error => {
								console.error('Error getting session:', error);
								updateMicStatus(false, 'Connection error');
								statusDiv.textContent = 'Error: Could not establish connection';
								statusDiv.className = 'mt-4 text-sm text-red-500 font-medium';
								// Re-enable the button so user can try again
								startButton.disabled = false;
								startButton.classList.remove('opacity-50');
								startButton.classList.add('bg-blue-500', 'hover:bg-blue-600');
							});
					})
					.catch(error => {
						console.error('Error creating offer:', error);
						updateMicStatus(false, 'Connection error');
						statusDiv.textContent = 'Error: Could not establish connection';
						statusDiv.className = 'mt-4 text-sm text-red-500 font-medium';
					});
			})
			.catch(error => {
				console.error('Error accessing microphone:', error);
				updateMicStatus(false, 'Connection error');
				statusDiv.textContent = 'Error: Could not establish connection';
				statusDiv.className = 'mt-4 text-sm text-red-500 font-medium';
			});

		// Error handling
		peerConnection.onerror = (error) => {
			console.error('WebRTC error:', error);
			updateMicStatus(false, 'Connection error');
			statusDiv.textContent = 'Error: Could not establish connection';
			statusDiv.className = 'mt-4 text-sm text-red-500 font-medium';
		};

		// Handle connection state changes
		peerConnection.onconnectionstatechange = (event) => {
			console.log('Connection state:', peerConnection.connectionState);
			switch(peerConnection.connectionState) {
				case 'disconnected':
				case 'failed':
					updateMicStatus(false, 'Disconnected');
					statusDiv.textContent = 'Connection lost. Please try again.';
					startButton.disabled = false;
					startButton.classList.remove('opacity-50');
					startButton.innerHTML = '<i class="fas fa-play-circle"></i><span>Start Conversation</span>';
					break;
				case 'connecting':
					updateMicStatus(false, 'Connecting...');
					break;
			}
		};
	}

	// Start conversation button click handler
	startButton.addEventListener('click', () => {
		statusDiv.textContent = 'Connecting...';
		startButton.disabled = true;
		startButton.classList.add('bg-gray-400');
		startButton.classList.remove('bg-blue-500', 'hover:bg-blue-600');
		initializeConnection();
	});
});
