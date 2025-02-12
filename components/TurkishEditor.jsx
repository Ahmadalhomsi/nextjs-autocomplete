"use client"
import React, { useEffect, useState, useRef } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";

const TurkishEditor = () => {
  const [content, setContent] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [socket, setSocket] = useState(null);
  const [currentWord, setCurrentWord] = useState({ text: "", start: 0, end: 0 });
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0);
  const [cursorPosition, setCursorPosition] = useState({ x: 0, y: 0 });
  const textAreaRef = useRef(null);
  const debounceTimer = useRef(null);

  useEffect(() => {
    const ws = new WebSocket("ws://localhost:8080");
    ws.onopen = () => {
      setIsConnected(true);
      setError(null);
    };
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'error') {
          setError(data.message);
          setIsLoading(false);
          return;
        }
        if (data.type === 'suggestions') {
          setSuggestions(Array.isArray(data.suggestions) ? data.suggestions : []);
          setShowSuggestions(Array.isArray(data.suggestions) && data.suggestions.length > 0);
          setIsLoading(false);
          setSelectedSuggestionIndex(0); // Reset selection when new suggestions arrive
        }
      } catch (err) {
        console.error("Error processing message:", err);
        setError("Error processing suggestions");
        setIsLoading(false);
      }
    };
    ws.onerror = (error) => {
      setError("Connection error occurred");
      setIsConnected(false);
    };
    ws.onclose = () => {
      setIsConnected(false);
    };
    setSocket(ws);
    return () => {
      ws.close();
    };
  }, []);

  const getCurrentWord = (text, cursorPos) => {
    const leftPart = text.slice(0, cursorPos).match(/\S*$/);
    const rightPart = text.slice(cursorPos).match(/^\S*/);
    
    const word = (leftPart || [''])[0] + (rightPart || [''])[0];
    const start = cursorPos - (leftPart || [''])[0].length;
    const end = cursorPos + (rightPart || [''])[0].length;
    
    return { text: word, start, end };
  };

  const handleInput = (e) => {
    const newContent = e.target.value;
    const cursorPos = e.target.selectionStart;
    setContent(newContent);
    // Get current word and its position
    const wordInfo = getCurrentWord(newContent, cursorPos);
    setCurrentWord(wordInfo);
    // Clear previous timer
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    // Only send request if there's a current word being typed
    if (wordInfo.text && wordInfo.text.trim() !== "") {
      // Debounce the request
      debounceTimer.current = setTimeout(() => {
        if (socket && socket.readyState === WebSocket.OPEN) {
          setIsLoading(true);
          setError(null);
          socket.send(JSON.stringify({ query: wordInfo.text }));
        }
      }, 200); // 200ms delay
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
    // Update cursor position
    updateCursorPosition(e);
  };

  const updateCursorPosition = (e) => {
    if (textAreaRef.current) {
      const textarea = textAreaRef.current;
      const cursorPos = e.target.selectionStart;
      const textBeforeCursor = content.substring(0, cursorPos);
      const lines = textBeforeCursor.split('\n');
      const currentLineNumber = lines.length - 1;

      // Create a temporary span to measure the cursor position
      const span = document.createElement('span');
      span.textContent = lines[currentLineNumber];
      span.style.whiteSpace = 'pre-wrap';
      span.style.visibility = 'hidden';
      document.body.appendChild(span);

      // Measure the width of the text before the cursor
      const textWidth = span.getBoundingClientRect().width;
      document.body.removeChild(span);

      // Get the textarea's position
      const textareaRect = textarea.getBoundingClientRect();
      const lineHeight = parseInt(window.getComputedStyle(textarea).lineHeight, 10);

      // Calculate the cursor's position
      const x = textareaRect.left + textWidth + 10; // Add a small offset
      const y = textareaRect.top + (currentLineNumber * lineHeight);

      setCursorPosition({ x, y });
    }
  };

  const handleKeyDown = (e) => {
    if (showSuggestions && suggestions.length > 0) {
      if (e.key === "Tab") {
        e.preventDefault(); // Prevent default tab behavior
        handleSuggestionClick(suggestions[selectedSuggestionIndex]);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedSuggestionIndex((prev) => 
          (prev + 1) % suggestions.length
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedSuggestionIndex((prev) =>
          (prev - 1 + suggestions.length) % suggestions.length
        );
      }
    }
  };

  const handleSuggestionClick = (suggestion) => {
    const before = content.slice(0, currentWord.start);
    const after = content.slice(currentWord.end);
    const newContent = before + suggestion + after;
    
    setContent(newContent);
    setShowSuggestions(false);
    
    // Focus back on textarea and set cursor position
    if (textAreaRef.current) {
      textAreaRef.current.focus();
      const newCursorPos = currentWord.start + suggestion.length;
      textAreaRef.current.setSelectionRange(newCursorPos, newCursorPos);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Turkish Text Editor</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isConnected && (
          <Alert variant="destructive">
            <AlertDescription>
              Not connected to server. Please check your connection.
            </AlertDescription>
          </Alert>
        )}
        
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <div className="relative">
          <Textarea
            ref={textAreaRef}
            value={content}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="Türkçe metninizi buraya yazın..."
            className="min-h-[200px]"
          />
          {isLoading && (
            <div className="absolute right-2 top-2">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          )}
          {showSuggestions && suggestions.length > 0 && (
            <div
              className="absolute bg-white border rounded-md shadow-lg z-10"
              style={{
                left: `${cursorPosition.x-630}px`,
                top: `${cursorPosition.y-60}px`,
              }}
            >
              {suggestions.map((suggestion, index) => (
                <div
                  key={index}
                  className={`px-4 py-2 cursor-pointer ${
                    index === selectedSuggestionIndex ? "bg-gray-100" : ""
                  }`}
                  onClick={() => handleSuggestionClick(suggestion)}
                >
                  {suggestion}
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default TurkishEditor;