import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Send, User, Volume2, VolumeX } from 'lucide-react';

const COHERE_API_KEY = import.meta.env.VITE_COHERE_API_KEY;
const COHERE_API_URL = 'https://api.cohere.ai/v1/chat';

interface Message {
  text: string;
  isUser: boolean;
}

interface Character {
  name: string;
  description: string;
  voice: {
    lang: string;
    name: string;
    pitch: number;
    rate: number;
  };
  speechStyle: (text: string) => string;
}

const characters: Character[] = [
  {
    name: "Friendly AI",
    description: "A helpful and friendly AI assistant",
    voice: { lang: "en-US", name: "Google US English", pitch: 1, rate: 1 },
    speechStyle: (text) => text,
  },
  {
    name: "Pirate Captain",
    description: "A gruff sea captain with a heart of gold",
    voice: { lang: "en-GB", name: "Google UK English Male", pitch: 0.9, rate: 0.9 },
    speechStyle: (text) => {
      const pirateWords = {
        'hello': 'ahoy',
        'hi': 'ahoy',
        'my': 'me',
        'friend': 'matey',
        'yes': 'aye',
        'no': 'nay',
        'you': 'ye',
        'your': 'yer',
        'is': 'be',
        'are': 'be',
        'for': 'fer',
        'to': 't\'',
        'of': 'o\'',
        'it': 'it be',
        'there': 'thar',
        'them': 'em',
        'their': 'thar',
        'okay': 'aye aye',
        'money': 'doubloons',
        'treasure': 'booty',
        'drink': 'grog',
        'food': 'grub',
        'ship': 'vessel',
        'boat': 'dinghy',
        'ocean': 'briny deep',
        'sea': 'high seas',
      };

      let pirateText = text.toLowerCase();
      Object.entries(pirateWords).forEach(([word, replacement]) => {
        const regex = new RegExp(`\\b${word}\\b`, 'gi');
        pirateText = pirateText.replace(regex, replacement);
      });

      pirateText = pirateText.replace(/ing\b/g, "in'");
      pirateText = pirateText.charAt(0).toUpperCase() + pirateText.slice(1);

      const pirateInterjections = [
        "Arrr!", 
        "Shiver me timbers!", 
        "Blimey!", 
        "Avast ye!", 
        "Yo ho ho!",
        "By Blackbeard's beard!",
        "Sail ho!",
      ];

      const randomInterjection = pirateInterjections[Math.floor(Math.random() * pirateInterjections.length)];
      return `${pirateText} ${randomInterjection}`;
    },
  },
  {
    name: "Sci-Fi Robot",
    description: "A logical and precise artificial being",
    voice: { lang: "en-US", name: "Google US English", pitch: 1.5, rate: 1.1 },
    speechStyle: (text) => text.toUpperCase().split('').join(' ') + ". BEEP. BOOP.",
  },
  {
    name: "Wise Wizard",
    description: "An ancient and knowledgeable magic user",
    voice: { lang: "en-GB", name: "Google UK English Male", pitch: 0.7, rate: 0.8 },
    speechStyle: (text) => `Hearken, young one. ${text} So mote it be.`,
  }
];

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [selectedCharacter, setSelectedCharacter] = useState<Character>(characters[0]);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);

  useEffect(() => {
    if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;

      recognitionRef.current.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }

        const fullTranscript = finalTranscript + interimTranscript;
        setInputText(fullTranscript);

        if (finalTranscript) {
          handleSendMessage(finalTranscript);
        }
      };

      recognitionRef.current.onerror = (event) => {
        console.error('Speech recognition error', event.error);
        setIsListening(false);
      };
    } else {
      console.error('Speech recognition not supported');
    }

    synthRef.current = window.speechSynthesis;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (synthRef.current) {
        synthRef.current.cancel();
      }
    };
  }, []);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      recognitionRef.current?.start();
      setInputText('');
    }
    setIsListening(!isListening);
  };

  const speakText = (text: string) => {
    if (synthRef.current) {
      synthRef.current.cancel(); // Stop any ongoing speech
      const utterance = new SpeechSynthesisUtterance(text);
      const voices = synthRef.current.getVoices();
      const characterVoice = voices.find(voice => 
        voice.lang === selectedCharacter.voice.lang && voice.name.includes(selectedCharacter.voice.name)
      );
      
      if (characterVoice) {
        utterance.voice = characterVoice;
      } else {
        console.warn(`Voice not found for ${selectedCharacter.name}. Using default voice.`);
      }
      
      utterance.pitch = selectedCharacter.voice.pitch;
      utterance.rate = selectedCharacter.voice.rate;

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = (event) => {
        console.error('Speech synthesis error', event);
        setIsSpeaking(false);
      };

      synthRef.current.speak(utterance);
    } else {
      console.error('Speech synthesis not supported');
    }
  };

  const handleSendMessage = async (text: string) => {
    if (text.trim()) {
      setMessages(prevMessages => [...prevMessages, { text, isUser: true }]);
      
      try {
        if (!COHERE_API_KEY) {
          throw new Error('Cohere API key is not set');
        }

        const response = await fetch(COHERE_API_URL, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${COHERE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: text,
            model: 'command',
            temperature: 0.9,
            chat_history: messages.map(m => ({ role: m.isUser ? 'USER' : 'CHATBOT', message: m.text })),
            preamble: `You are ${selectedCharacter.name}. ${selectedCharacter.description}. Respond in character, using the appropriate accent and mannerisms.`,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to generate response');
        }

        const data = await response.json();
        const generatedText = data.text;
        const styledText = selectedCharacter.speechStyle(generatedText.trim());
        setMessages(prevMessages => [...prevMessages, { text: styledText, isUser: false }]);
        
        speakText(styledText);
      } catch (error) {
        console.error('Error generating response:', error);
        const errorMessage = `Sorry, I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}`;
        setMessages(prevMessages => [...prevMessages, { text: errorMessage, isUser: false }]);
        
        speakText(errorMessage);
      }
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSendMessage(inputText);
      setInputText('');
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <header className="bg-purple-600 text-white p-4">
        <h1 className="text-2xl font-bold">Realtime Speech Chat with Characters</h1>
      </header>
      <div className="bg-white p-4 flex items-center justify-between">
        <div className="flex items-center">
          <User size={24} className="mr-2" />
          <select
            value={selectedCharacter.name}
            onChange={(e) => setSelectedCharacter(characters.find(c => c.name === e.target.value) || characters[0])}
            className="border rounded p-2"
          >
            {characters.map((character) => (
              <option key={character.name} value={character.name}>
                {character.name}
              </option>
            ))}
          </select>
        </div>
        <div className="text-sm text-gray-500">{selectedCharacter.description}</div>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`mb-4 ${
              message.isUser ? 'text-right' : 'text-left'
            }`}
          >
            <span
              className={`inline-block p-2 rounded-lg ${
                message.isUser
                  ? 'bg-purple-500 text-white'
                  : 'bg-gray-300 text-black'
              }`}
            >
              {message.text}
            </span>
          </div>
        ))}
        {isSpeaking && (
          <div className="text-center text-gray-500 animate-pulse">
            AI is speaking...
          </div>
        )}
      </div>
      <div className="bg-white p-4 flex flex-col items-stretch">
        <div className="flex items-center mb-2">
          <button
            onClick={toggleListening}
            className={`p-2 rounded-full mr-2 ${
              isListening ? 'bg-red-500' : 'bg-gray-200'
            }`}
          >
            {isListening ? <MicOff size={24} /> : <Mic size={24} />}
          </button>
          <div className="flex-1 text-sm text-gray-500">
            {isListening ? 'Listening...' : 'Click mic to start speaking'}
          </div>
          <button
            onClick={() => synthRef.current?.cancel()}
            className="p-2 rounded-full bg-gray-200"
          >
            {isSpeaking ? <Volume2 size={24} /> : <VolumeX size={24} />}
          </button>
        </div>
        <div className="flex">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyPress={handleKeyPress}
            className="flex-1 border rounded-l-lg p-2"
            placeholder="Type or speak your message..."
          />
          <button
            onClick={() => {
              handleSendMessage(inputText);
              setInputText('');
            }}
            className="bg-purple-500 text-white p-2 rounded-r-lg"
          >
            <Send size={24} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;