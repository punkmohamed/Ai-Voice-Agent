document.addEventListener('DOMContentLoaded', () => {
	// UI Elements
	const startButton = document.getElementById('startConversation');
	const statusDiv = document.getElementById('status');
	const conversationDiv = document.getElementById('conversation');
	const mainContainer = document.getElementById('mainContainer');
	const logTableBody = document.getElementById('logTableBody');

	// WebRTC variables
	let peerConnection;
	let dataChannel;

	// Add message to log
	function addToLog(type, message) {
		if (!message || message.trim() === '') return; // Don't log empty messages
		
		const row = document.createElement('tr');
		row.className = 'border-b hover:bg-gray-50';
		
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
		if (!text || text.trim() === '') return; // Don't add empty messages
		
		const messageEl = document.createElement('div');
		messageEl.className = isUser
			? 'bg-blue-100 p-3 rounded-lg ml-auto max-w-[80%]'
			: 'bg-gray-100 p-3 rounded-lg max-w-[80%]';
		messageEl.textContent = text;
		conversationDiv.appendChild(messageEl);
		conversationDiv.scrollTop = conversationDiv.scrollHeight;
	}

	// Initialize WebRTC connection
	function initializeConnection() {
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
						
						// Update existing message or create new one for partial
						const userMessageId = `user-${msg.transcript_id}`;
						let userMessage = document.getElementById(userMessageId);

						if (!userMessage) {
							userMessage = document.createElement('div');
							userMessage.id = userMessageId;
							userMessage.className = 'bg-blue-100 p-3 rounded-lg ml-auto max-w-[80%] mb-2';
							conversationDiv.appendChild(userMessage);
						}

						userMessage.textContent = userText;
						conversationDiv.scrollTop = conversationDiv.scrollHeight;
					} else if (msg.type === 'transcript.complete') {
						statusDiv.textContent = 'Connected! You can speak now.';
						statusDiv.className = 'mt-4 text-sm text-gray-500 font-medium';
						
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
									statusDiv.textContent = 'Error connecting to AI service. Please try again.';
									// Re-enable the button so user can try again
									startButton.disabled = false;
									startButton.classList.remove('bg-gray-400');
									startButton.classList.add('bg-blue-500', 'hover:bg-blue-600');
								});
							})
							.catch(error => {
								console.error('Error getting session:', error);
								statusDiv.textContent = 'Error starting session. Please check console for details.';
								// Re-enable the button so user can try again
								startButton.disabled = false;
								startButton.classList.remove('bg-gray-400');
								startButton.classList.add('bg-blue-500', 'hover:bg-blue-600');
							});
					})
					.catch(error => {
						console.error('Error creating offer:', error);
						statusDiv.textContent = 'Error setting up connection. Please try again.';
					});
			})
			.catch(error => {
				console.error('Error accessing microphone:', error);
				statusDiv.textContent = 'Error accessing microphone. Please check permissions and try again.';
			});
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
