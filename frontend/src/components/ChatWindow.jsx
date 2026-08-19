import { useEffect, useRef, useState } from "react";
import InputBox from "./InputBox";
import novaBot from "../assets/nova-bot.jpeg";
import "./ChatWindow.css";

const cleanResponse = (text) => {
  if (!text) return "";

  let cleaned = String(text);

  cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, "");
  cleaned = cleaned.replace(/<think>[\s\S]*/gi, "");
  cleaned = cleaned.replace(/```[\w-]*\n?/g, "");
  cleaned = cleaned.replace(/```/g, "");
  cleaned = cleaned.replace(/\*\*\*/g, "");
  cleaned = cleaned.replace(/\*\*/g, "");
  cleaned = cleaned.replace(/^\s*\*+\s*/gm, "");
  cleaned = cleaned.replace(/^\s*[-*]\s+/gm, "• ");
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n");

  return cleaned.trim();
};

const formatResponseTime = (time) => {
  if (time === undefined || time === null || time === "") {
    return "";
  }

  const number = Number(time);

  if (Number.isNaN(number)) {
    return "";
  }

  return `${number.toFixed(2)}s`;
};

const formatFileSize = (bytes) => {
  if (!bytes) return "";

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

function ChatWindow({ chat, updateChat }) {
  const messagesEndRef = useRef(null);

  const [isLoading, setIsLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState(null);

  const messages = chat?.messages || [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages, isLoading]);

  const handleCopy = async (text, index) => {
    try {
      await navigator.clipboard.writeText(text);

      setCopiedIndex(index);

      setTimeout(() => {
        setCopiedIndex(null);
      }, 1500);
    } catch (error) {
      console.error("Copy failed:", error);
    }
  };

  if (!chat) {
    return null;
  }

  return (
    <main className="chat-window">
      <header className="chat-header">
        <div className="chat-header-left">
          <div className="nova-header-icon">
            <img src={novaBot} alt="Nova" />
          </div>

          <div className="nova-header-info">
            <h1>Nova</h1>
            <span>AI Assistant</span>
          </div>
        </div>

        <div className="online-status">
          <span className="online-dot"></span>
          Online
        </div>
      </header>

      <section className="messages-area">
        {messages.length === 0 && (
          <div className="welcome-screen">
            <div className="welcome-icon">
              <img src={novaBot} alt="Nova" />
            </div>

            <h2>How can I help you?</h2>

            <p>
              Ask me anything or upload a PDF, DOC,
              DOCX, JPG or PNG.
            </p>

            <div className="suggestion-list">
              <button
                type="button"
                disabled={isLoading}
                onClick={() => {
                  window.dispatchEvent(
                    new CustomEvent("nova-suggestion", {
                      detail: {
                        message: "Explain AI simply.",
                      },
                    })
                  );
                }}
              >
                Explain AI simply
              </button>

              <button
                type="button"
                disabled={isLoading}
                onClick={() => {
                  window.dispatchEvent(
                    new CustomEvent("nova-suggestion", {
                      detail: {
                        message:
                          "Write a professional email.",
                      },
                    })
                  );
                }}
              >
                Write an email
              </button>

              <button
                type="button"
                disabled={isLoading}
                onClick={() => {
                  window.dispatchEvent(
                    new CustomEvent("nova-suggestion", {
                      detail: {
                        message:
                          "Give me project ideas.",
                      },
                    })
                  );
                }}
              >
                Project ideas
              </button>
            </div>
          </div>
        )}

        {messages.map((message, index) => {
          const isUser = message.role === "user";
          const cleanedContent = cleanResponse(
            message.content
          );

          const lines = cleanedContent
            ? cleanedContent.split("\n")
            : [];

          return (
            <div
              className={
                isUser
                  ? "message-row user-row"
                  : "message-row assistant-row"
              }
              key={
                message.id ||
                `${index}-${message.role}`
              }
            >
              {!isUser && (
                <div className="message-avatar">
                  <img src={novaBot} alt="Nova" />
                </div>
              )}

              <div className="message-content-wrapper">
                {!isUser && (
                  <div className="message-name">
                    Nova
                  </div>
                )}

                <div
                  className={
                    isUser
                      ? "message-bubble user-bubble"
                      : "message-bubble assistant-bubble"
                  }
                >
                  {isUser && message.file && (
                    <div className="message-file">
                      <div className="message-file-icon">
                        📎
                      </div>

                      <div className="message-file-info">
                        <div className="message-file-name">
                          {message.file.filename}
                        </div>

                        <div className="message-file-type">
                          {message.file.file_type ||
                            "File"}

                          {message.file.size && (
                            <>
                              {" • "}
                              {formatFileSize(
                                message.file.size
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {cleanedContent && (
                    <div className="message-text">
                      {lines.map(
                        (line, lineIndex) => (
                          <span key={lineIndex}>
                            {line}
                            {lineIndex <
                              lines.length - 1 && (
                              <br />
                            )}
                          </span>
                        )
                      )}
                    </div>
                  )}
                </div>

                {!isUser && !message.isError && (
                  <div className="message-actions">
                    <button
                      type="button"
                      onClick={() =>
                        handleCopy(
                          cleanedContent,
                          index
                        )
                      }
                    >
                      {copiedIndex === index
                        ? "✓ Copied"
                        : "Copy"}
                    </button>

                    {message.responseTime !==
                      undefined &&
                      message.responseTime !==
                        null && (
                        <span className="response-time">
                          ⚡{" "}
                          {formatResponseTime(
                            message.responseTime
                          )}
                        </span>
                      )}
                  </div>
                )}
              </div>

              {isUser && (
                <div className="user-avatar">
                  You
                </div>
              )}
            </div>
          );
        })}

        {isLoading && (
          <div className="message-row assistant-row">
            <div className="message-avatar">
              <img src={novaBot} alt="Nova" />
            </div>

            <div className="message-content-wrapper">
              <div className="message-name">
                Nova
              </div>

              <div className="message-bubble assistant-bubble loading-bubble">
                <span className="typing-dot"></span>
                <span className="typing-dot"></span>
                <span className="typing-dot"></span>
              </div>
            </div>
          </div>
        )}

        <div
          ref={messagesEndRef}
          className="messages-end"
        />
      </section>

      <InputBox
        chat={chat}
        updateChat={updateChat}
        isLoading={isLoading}
        setIsLoading={setIsLoading}
      />
    </main>
  );
}

export default ChatWindow;