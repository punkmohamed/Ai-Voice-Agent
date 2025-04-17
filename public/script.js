document.addEventListener('DOMContentLoaded', () => {
	// UI Elements
	const startButton = document.getElementById('startConversation');
	const toggleCustomizationButton = document.getElementById('toggleCustomization');
	const customizationPanel = document.getElementById('customizationPanel');
	const statusDiv = document.getElementById('status');
	const conversationDiv = document.getElementById('conversation');
	const mainContainer = document.getElementById('mainContainer');
	const mainTitle = document.getElementById('mainTitle');
	const mainDescription = document.getElementById('mainDescription');
	const bgColorPicker = document.getElementById('bgColorPicker');
	const textColorPicker = document.getElementById('textColorPicker');

	// WebRTC variables
	let peerConnection;
	let dataChannel;

	// Customization functions
	function applyBackgroundColor(color) {
		mainContainer.style.backgroundColor = color;
		return { success: true, color };
	}

	function applyTextColor(color) {
		mainContainer.style.color = color;
		mainTitle.style.color = color;
		mainDescription.style.color = color;
		return { success: true, color };
	}

	function applyButtonColor(colorName) {
		const colorClasses = {
			blue: ['bg-blue-500', 'hover:bg-blue-600'],
			green: ['bg-green-500', 'hover:bg-green-600'],
			purple: ['bg-purple-500', 'hover:bg-purple-600'],
			red: ['bg-red-500', 'hover:bg-red-600'],
			yellow: ['bg-yellow-500', 'hover:bg-yellow-600']
		};

		if (!colorClasses[colorName]) return { success: false, error: 'Invalid color name' };

		// Remove all color classes from buttons
		const allColorClasses = Object.values(colorClasses).flat();
		startButton.classList.remove(...allColorClasses);
		toggleCustomizationButton.classList.remove(...allColorClasses);

		// Add new color classes
		startButton.classList.add(...colorClasses[colorName]);
		toggleCustomizationButton.classList.add(...colorClasses[colorName]);

		return { success: true, colorName };
	}

	function applyTextSize(size) {
		const sizeClasses = {
			small: ['text-sm', 'text-xs', 'text-lg'],
			medium: ['text-base', 'text-sm', 'text-xl'],
			large: ['text-lg', 'text-base', 'text-2xl']
		};

		if (!sizeClasses[size]) return { success: false, error: 'Invalid size' };

		// Remove all size classes
		const allSizeClasses = Object.values(sizeClasses).flat();
		mainContainer.classList.remove(...allSizeClasses);

		// Add new size class
		mainContainer.classList.add(sizeClasses[size][0]);
		mainDescription.classList.remove('text-sm', 'text-base', 'text-lg');
		mainDescription.classList.add(sizeClasses[size][1]);
		mainTitle.classList.remove('text-xl', 'text-2xl', 'text-3xl', 'text-4xl');
		mainTitle.classList.add(sizeClasses[size][2]);

		return { success: true, size };
	}

	// Helper functions for AI commands
	const uiFunctions = {
		changeBackgroundColor: (color) => applyBackgroundColor(color),
		changeTextColor: (color) => applyTextColor(color),
		changeButtonColor: (colorName) => applyButtonColor(colorName),
		changeTextSize: (size) => applyTextSize(size)
	};

	// Toggle customization panel
	toggleCustomizationButton.addEventListener('click', () => {
		customizationPanel.classList.toggle('hidden');
	});

	// Set up color pickers
	bgColorPicker.addEventListener('input', (e) => {
		applyBackgroundColor(e.target.value);
	});

	textColorPicker.addEventListener('input', (e) => {
		applyTextColor(e.target.value);
	});

	// Set up color buttons
	document.querySelectorAll('[data-color]').forEach(button => {
		button.addEventListener('click', () => {
			const color = button.getAttribute('data-color');
			const parent = button.closest('div').parentElement;

			if (parent.querySelector('label').textContent.includes('Background')) {
				bgColorPicker.value = color;
				applyBackgroundColor(color);
			} else if (parent.querySelector('label').textContent.includes('Text Color')) {
				textColorPicker.value = color;
				applyTextColor(color);
			} else if (parent.querySelector('label').textContent.includes('Button')) {
				applyButtonColor(color);
			}
		});
	});

	// Set up text size buttons
	document.querySelectorAll('[data-size]').forEach(button => {
		button.addEventListener('click', () => {
			const size = button.getAttribute('data-size');
			applyTextSize(size);
		});
	});

	// Create a message element to add to the conversation
	function addMessage(text, isUser = false) {
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
					modalities: ['text', 'audio'],
					tools: [
						{
							type: 'function',
							name: 'changeBackgroundColor',
							description: 'Changes the background color of the interface',
							parameters: {
								type: 'object',
								properties: {
									color: { type: 'string', description: 'Color value (hex code or color name)' },
								},
								required: ['color']
							}
						},
						{
							type: 'function',
							name: 'changeTextColor',
							description: 'Changes the text color of the interface',
							parameters: {
								type: 'object',
								properties: {
									color: { type: 'string', description: 'Color value (hex code or color name)' },
								},
								required: ['color']
							}
						},
						{
							type: 'function',
							name: 'changeButtonColor',
							description: 'Changes the button color of the interface',
							parameters: {
								type: 'object',
								properties: {
									colorName: {
										type: 'string',
										enum: ['blue', 'green', 'purple', 'red', 'yellow'],
										description: 'Color name (blue, green, purple, red, yellow)'
									},
								},
								required: ['colorName']
							}
						},
						{
							type: 'function',
							name: 'changeTextSize',
							description: 'Changes the text size of the interface',
							parameters: {
								type: 'object',
								properties: {
									size: {
										type: 'string',
										enum: ['small', 'medium', 'large'],
										description: 'Text size (small, medium, large)'
									},
								},
								required: ['size']
							}
						}
					]
				}
			};
			dataChannel.send(JSON.stringify(event));
			statusDiv.textContent = 'Connected! You can speak now.';
			addMessage('Hello! How can I help you today? You can ask me to change colors and text size.', false);
		});

		// Variables to track conversation state
		let currentResponseId = null;
		let currentMessageElement = null;

		// Clear any previous conversation
		conversationDiv.innerHTML = '';

		// Handle incoming messages
		dataChannel.addEventListener('message', (event) => {
			const msg = JSON.parse(event.data);
			console.log('Received message:', msg);

			// Handle text responses
			if (msg.type === 'response.text.delta') {
				// Show visual indicator that AI is responding
				statusDiv.textContent = 'AI is responding...';
				statusDiv.className = 'mt-4 text-sm text-green-500 font-medium';

				// Check if this is a new response or continuation
				if (currentResponseId !== msg.response_id) {
					currentResponseId = msg.response_id;
					currentMessageElement = document.createElement('div');
					currentMessageElement.className = 'bg-gray-100 p-3 rounded-lg max-w-[80%] mb-2';
					conversationDiv.appendChild(currentMessageElement);
				}

				// Add the text to the current message
				if (msg.delta && msg.delta.text) {
					currentMessageElement.textContent += msg.delta.text;
					conversationDiv.scrollTop = conversationDiv.scrollHeight;
				}
			}

			// Handle function calls from the AI
			if (msg.type === 'response.function_call_arguments.done') {
				console.log(`AI is calling function: ${msg.name} with args: ${msg.arguments}`);

				let result = { success: false, error: 'Function not found' };
				const args = JSON.parse(msg.arguments);

				// Execute the appropriate function
				switch(msg.name) {
					case 'changeBackgroundColor':
						result = applyBackgroundColor(args.color);
						break;
					case 'changeTextColor':
						result = applyTextColor(args.color);
						break;
					case 'changeButtonColor':
						result = applyButtonColor(args.colorName);
						break;
					case 'changeTextSize':
						result = applyTextSize(args.size);
						break;
				}

				// Send the result back to the AI
				const resultEvent = {
					type: 'conversation.item.create',
					item: {
						type: 'function_call_output',
						call_id: msg.call_id,
						output: JSON.stringify(result)
					}
				};
				dataChannel.send(JSON.stringify(resultEvent));

				// Ask the AI to continue the conversation
				dataChannel.send(JSON.stringify({ type: 'response.create' }));
			}

			// Handle user transcript (what the user said)
			if (msg.type === 'transcript.partial' || msg.type === 'transcript.complete') {
				// Show visual indicator that microphone is active
				if (msg.type === 'transcript.partial') {
					statusDiv.textContent = 'Listening...';
					statusDiv.className = 'mt-4 text-sm text-blue-500 font-medium animate-pulse';
				} else if (msg.type === 'transcript.complete') {
					statusDiv.textContent = 'Connected! You can speak now.';
					statusDiv.className = 'mt-4 text-sm text-gray-500 font-medium';
				}

				if (msg.transcript && msg.transcript.text) {
					// Check if there's already a user message with this ID
					const userMessageId = `user-${msg.transcript_id}`;
					let userMessage = document.getElementById(userMessageId);

					if (!userMessage) {
						// Create a new user message
						userMessage = document.createElement('div');
						userMessage.id = userMessageId;
						userMessage.className = 'bg-blue-100 p-3 rounded-lg ml-auto max-w-[80%] mb-2';
						conversationDiv.appendChild(userMessage);
					}

					// Update the message text
					userMessage.textContent = msg.transcript.text;
					conversationDiv.scrollTop = conversationDiv.scrollHeight;
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
