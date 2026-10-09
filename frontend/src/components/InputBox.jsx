import { useEffect, useRef, useState } from "react";
import axios from "axios";
import "./InputBox.css";

const API_URL = (import.meta.env.VITE_API_URL || "")
  .trim()
  .replace(/\/+$/, "");

const formatFileSize = (bytes) => {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

function InputBox({ chat, updateChat, isLoading, setIsLoading }) {
  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);
  const chatRef = useRef(chat);
  const loadingRef = useRef(isLoading);

  useEffect(() => {
    chatRef.current = chat;
  }, [chat]);

  useEffect(() => {
    loadingRef.current = isLoading;
  }, [isLoading]);

  const getApiUrl = () => {
    if (!API_URL) {
      alert("VITE_API_URL is missing. Please check your .env file and restart Vite.");
      console.error("Missing VITE_API_URL environment variable.");
      return null;
    }
    return API_URL;
  };

  const handleSuggestion = (event) => {
    const suggestedMessage = event.detail?.message;
    if (!suggestedMessage || loadingRef.current) return;
    sendMessage(suggestedMessage);
  };

  useEffect(() => {
    window.addEventListener("nova-suggestion", handleSuggestion);
    return () => {
      window.removeEventListener("nova-suggestion", handleSuggestion);
    };
  }, []);

  const openFileSelector = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const api = getApiUrl();
    if (!api) {
      event.target.value = "";
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      alert("File size must be less than 20 MB.");
      event.target.value = "";
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await axios.post(`${api}/api/upload`, formData);
      const data = response.data;

      if (data.success || data.file_id) {
        const updatedChat = {
          ...chatRef.current,
          fileName: data.filename || file.name,
          fileContext: data.text || data.file_context || "",
          fileId: data.file_id || null,
          fileType: data.file_type || file.type,
          fileSize: data.size || file.size,
        };

        chatRef.current = updatedChat;
        updateChat(updatedChat);
      } else {
        alert("File upload failed.");
      }
    } catch (error) {
      console.error("UPLOAD ERROR:", error);
      alert(
        error.response?.data?.detail ||
        error.response?.data?.message ||
        "File upload failed. Check your backend URL and server."
      );
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  const removeFile = () => {
    const updatedChat = {
      ...chatRef.current,
      fileName: "",
      fileContext: "",
      fileId: null,
      fileType: "",
      fileSize: 0,
    };

    chatRef.current = updatedChat;
    updateChat(updatedChat);
  };

  const sendMessage = async (suggestedText = null) => {
    const api = getApiUrl();
    if (!api || loadingRef.current) return;

    const currentChat = chatRef.current;
    const text =
      suggestedText !== null
        ? String(suggestedText).trim()
        : message.trim();

    if (!text && !currentChat.fileId) return;

    const finalMessage = text || "Please analyze this file.";

    const userMessage = {
      id: Date.now() + Math.random(),
      role: "user",
      content: finalMessage,
      file: currentChat.fileId
        ? {
            filename: currentChat.fileName,
            file_type: currentChat.fileType,
            size: currentChat.fileSize,
          }
        : null,
    };

    const previousMessages = currentChat.messages || [];
    const updatedMessages = [...previousMessages, userMessage];

    const chatWithUserMessage = {
      ...currentChat,
      messages: updatedMessages,
    };

    chatRef.current = chatWithUserMessage;
    updateChat(chatWithUserMessage);
    setMessage("");

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    loadingRef.current = true;
    setIsLoading(true);

    const startTime = performance.now();

    try {
      const response = await axios.post(`${api}/api/chat`, {
        message: finalMessage,
        file_id: currentChat.fileId || null,
        context: currentChat.fileContext || "",
        history: previousMessages.map((item) => ({
          role: item.role,
          content: item.content,
        })),
      });

      const responseTime = (performance.now() - startTime) / 1000;

      let reply =
        response.data?.reply ||
        response.data?.response ||
        response.data?.answer ||
        "";

      reply = String(reply)
        .replace(/<think>[\s\S]*?<\/think>/gi, "")
        .replace(/<think>[\s\S]*/gi, "")
        .replace(/\*\*/g, "")
        .replace(/```[\w-]*\n?/g, "")
        .trim();

      if (!reply) {
        reply = "I couldn't generate a response.";
      }

      const aiMessage = {
        id: Date.now() + Math.random(),
        role: "assistant",
        content: reply,
        responseTime: response.data?.responseTime ?? responseTime,
        isError: false,
      };

      const finalChat = {
        ...chatWithUserMessage,
        messages: [...updatedMessages, aiMessage],
      };

      chatRef.current = finalChat;
      updateChat(finalChat);
    } catch (error) {
      console.error("CHAT ERROR:", error);

      const responseTime = (performance.now() - startTime) / 1000;

      const errorText =
        error.response?.data?.detail ||
        error.response?.data?.message ||
        (error.response
          ? `Server error: ${error.response.status}`
          : "Unable to connect to the AI server. Check your backend URL and server status.");

      const errorMessage = {
        id: Date.now() + Math.random(),
        role: "assistant",
        content: errorText,
        responseTime,
        isError: true,
      };

      const finalChat = {
        ...chatWithUserMessage,
        messages: [...updatedMessages, errorMessage],
      };

      chatRef.current = finalChat;
      updateChat(finalChat);
    } finally {
      loadingRef.current = false;
      setIsLoading(false);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (!isLoading && !uploading) sendMessage();
    }
  };

  const handleInput = (event) => {
    setMessage(event.target.value);

    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`;
  };

  const getFileIcon = () => {
    const type = chat.fileType || "";
    const name = chat.fileName?.toLowerCase() || "";

    if (type.startsWith("image/")) return "🖼️";
    if (type.includes("pdf") || name.endsWith(".pdf")) return "📕";

    if (
      type.includes("word") ||
      name.endsWith(".doc") ||
      name.endsWith(".docx")
    ) {
      return "📘";
    }

    return "📎";
  };

  return (
    <div className="input-area">
      {chat.fileName && (
        <div className="selected-file">
          <div className="selected-file-left">
            <div className="selected-file-icon">{getFileIcon()}</div>
            <div className="selected-file-info">
              <div className="selected-file-name">{chat.fileName}</div>
              <div className="selected-file-size">
                {formatFileSize(chat.fileSize)}
              </div>
            </div>
          </div>

          <button
            type="button"
            className="remove-file-btn"
            onClick={removeFile}
            disabled={isLoading || uploading}
            title="Remove file"
          >
            ×
          </button>
        </div>
      )}

      <div className="input-wrapper">
        <button
          type="button"
          className="attach-btn"
          onClick={openFileSelector}
          disabled={uploading || isLoading}
          title="Attach file"
        >
          📎
        </button>

        <input
          ref={fileInputRef}
          type="file"
          className="hidden-file-input"
          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,.gif"
          onChange={handleFileChange}
        />

        <textarea
          ref={textareaRef}
          value={message}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={
            uploading
              ? "Uploading file..."
              : isLoading
              ? "Nova is thinking..."
              : "Message Nova..."
          }
          rows={1}
          disabled={uploading || isLoading}
        />

        <button
          type="button"
          className="send-btn"
          onClick={() => sendMessage()}
          disabled={
            uploading ||
            isLoading ||
            (!message.trim() && !chat.fileId)
          }
          title="Send"
        >
          {isLoading ? "..." : "➤"}
        </button>
      </div>

      <div className="input-bottom">
        <div className="file-types">
          <span>PDF</span>
          <span>DOC</span>
          <span>DOCX</span>
          <span>JPG</span>
          <span>PNG</span>
        </div>

        <div className="keyboard-hint">
          Enter to send · Shift + Enter for new line
        </div>
      </div>
    </div>
  );
}

export default InputBox;