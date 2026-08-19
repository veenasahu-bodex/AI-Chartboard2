import {
  useEffect,
  useRef,
  useState,
} from "react";
import axios from "axios";
import "./InputBox.css";

const API_URL = "http://127.0.0.1:8000";

const formatFileSize = (bytes) => {
  if (!bytes) return "";

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(
    bytes /
    (1024 * 1024)
  ).toFixed(1)} MB`;
};

function InputBox({
  chat,
  updateChat,
  isLoading,
  setIsLoading,
}) {
  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState(false);

  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);

  // ====================================================
  // SUGGESTION BUTTON CONNECTION
  // ====================================================

  useEffect(() => {
    const handleSuggestion = (event) => {
      const suggestedMessage =
        event.detail?.message;

      if (!suggestedMessage || isLoading) {
        return;
      }

      sendMessage(suggestedMessage);
    };

    window.addEventListener(
      "nova-suggestion",
      handleSuggestion
    );

    return () => {
      window.removeEventListener(
        "nova-suggestion",
        handleSuggestion
      );
    };
  }, [chat, isLoading]);

  // ====================================================
  // OPEN FILE SELECTOR
  // ====================================================

  const openFileSelector = () => {
    fileInputRef.current?.click();
  };

  // ====================================================
  // FILE UPLOAD
  // ====================================================

  const handleFileChange = async (event) => {
    const file =
      event.target.files?.[0];

    if (!file) return;

    const maxSize =
      20 * 1024 * 1024;

    if (file.size > maxSize) {
      alert(
        "File size must be less than 20 MB."
      );

      event.target.value = "";
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();

      formData.append("file", file);

      const response =
        await axios.post(
          `${API_URL}/api/upload`,
          formData,
          {
            headers: {
              "Content-Type":
                "multipart/form-data",
            },
          }
        );

      const data = response.data;

      if (
        data.success ||
        data.file_id
      ) {
        updateChat({
          ...chat,
          fileName:
            data.filename ||
            file.name,
          fileContext:
            data.text ||
            data.file_context ||
            "",
          fileId:
            data.file_id ||
            null,
          fileType:
            data.file_type ||
            file.type,
          fileSize:
            data.size ||
            file.size,
        });
      } else {
        alert("File upload failed.");
      }
    } catch (error) {
      console.error(
        "UPLOAD ERROR:",
        error
      );

      const errorMessage =
        error.response?.data?.detail ||
        error.response?.data?.message ||
        "File upload failed.";

      alert(errorMessage);
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  // ====================================================
  // REMOVE FILE
  // ====================================================

  const removeFile = () => {
    updateChat({
      ...chat,
      fileName: "",
      fileContext: "",
      fileId: null,
      fileType: "",
      fileSize: 0,
    });
  };

  // ====================================================
  // SEND MESSAGE
  // ====================================================

  const sendMessage = async (
    suggestedText = null
  ) => {
    const text =
      suggestedText !== null
        ? suggestedText.trim()
        : message.trim();

    if (
      !text &&
      !chat.fileId
    ) {
      return;
    }

    if (isLoading) {
      return;
    }

    const userMessage = {
      id:
        Date.now() +
        Math.random(),

      role: "user",

      content:
        text ||
        "Please analyze this file.",

      file: chat.fileId
        ? {
            filename:
              chat.fileName,

            file_type:
              chat.fileType,

            size:
              chat.fileSize,
          }
        : null,
    };

    const updatedMessages = [
      ...(chat.messages || []),
      userMessage,
    ];

    updateChat({
      ...chat,
      messages: updatedMessages,
    });

    setMessage("");

    if (textareaRef.current) {
      textareaRef.current.style.height =
        "auto";
    }

    setIsLoading(true);

    const startTime =
      performance.now();

    try {
      const response =
        await axios.post(
          `${API_URL}/api/chat`,
          {
            message:
              text ||
              "Please analyze this file.",

            file_id:
              chat.fileId ||
              null,

            context:
              chat.fileContext ||
              "",

            history:
              (chat.messages || []).map(
                (item) => ({
                  role: item.role,
                  content:
                    item.content,
                })
              ),
          }
        );

      const endTime =
        performance.now();

      const responseTime =
        (endTime - startTime) / 1000;

      let reply =
        response.data?.reply ||
        response.data?.response ||
        response.data?.answer ||
        "";

      reply = String(reply);

      reply = reply.replace(
        /<think>[\s\S]*?<\/think>/gi,
        ""
      );

      reply = reply.replace(
        /<think>[\s\S]*/gi,
        ""
      );

      reply = reply.replace(
        /\*\*\*/g,
        ""
      );

      reply = reply.replace(
        /\*\*/g,
        ""
      );

      reply = reply.replace(
        /```[\w-]*\n?/g,
        ""
      );

      reply = reply.replace(
        /```/g,
        ""
      );

      reply = reply.trim();

      if (!reply) {
        reply =
          "I couldn't generate a response.";
      }

      const aiMessage = {
        id:
          Date.now() +
          Math.random(),

        role: "assistant",

        content: reply,

        responseTime:
          response.data?.responseTime ??
          responseTime,

        isError: false,
      };

      updateChat({
        ...chat,

        messages: [
          ...updatedMessages,
          aiMessage,
        ],
      });
    } catch (error) {
      console.error(
        "CHAT ERROR:",
        error
      );

      const endTime =
        performance.now();

      const responseTime =
        (endTime - startTime) / 1000;

      const errorText =
        error.response?.data?.detail ||
        error.response?.data?.message ||
        "Unable to connect with Nova AI server.";

      const errorMessage = {
        id:
          Date.now() +
          Math.random(),

        role: "assistant",

        content: errorText,

        responseTime,

        isError: true,
      };

      updateChat({
        ...chat,

        messages: [
          ...updatedMessages,
          errorMessage,
        ],
      });
    } finally {
      setIsLoading(false);
    }
  };

  // ====================================================
  // KEYBOARD
  // ====================================================

  const handleKeyDown = (event) => {
    if (
      event.key === "Enter" &&
      !event.shiftKey
    ) {
      event.preventDefault();

      if (!isLoading) {
        sendMessage();
      }
    }
  };

  // ====================================================
  // TEXT CHANGE
  // ====================================================

  const handleInput = (event) => {
    setMessage(event.target.value);

    const textarea =
      textareaRef.current;

    if (!textarea) return;

    textarea.style.height = "auto";

    textarea.style.height =
      `${Math.min(
        textarea.scrollHeight,
        150
      )}px`;
  };

  // ====================================================
  // FILE ICON
  // ====================================================

  const getFileIcon = () => {
    const type =
      chat.fileType || "";

    if (type.startsWith("image/")) {
      return "🖼️";
    }

    if (
      type.includes("pdf") ||
      chat.fileName
        ?.toLowerCase()
        .endsWith(".pdf")
    ) {
      return "📕";
    }

    if (
      type.includes("word") ||
      chat.fileName
        ?.toLowerCase()
        .endsWith(".doc") ||
      chat.fileName
        ?.toLowerCase()
        .endsWith(".docx")
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
            <div className="selected-file-icon">
              {getFileIcon()}
            </div>

            <div className="selected-file-info">
              <div className="selected-file-name">
                {chat.fileName}
              </div>

              <div className="selected-file-size">
                {formatFileSize(
                  chat.fileSize
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            className="remove-file-btn"
            onClick={removeFile}
            disabled={isLoading}
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
          disabled={
            uploading ||
            isLoading
          }
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
          disabled={
            uploading ||
            isLoading
          }
        />

        <button
          type="button"
          className="send-btn"
          onClick={() =>
            sendMessage()
          }
          disabled={
            uploading ||
            isLoading ||
            (
              !message.trim() &&
              !chat.fileId
            )
          }
          title="Send"
        >
          {isLoading
            ? "..."
            : "➤"}
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
          Enter to send · Shift + Enter
          for new line
        </div>
      </div>
    </div>
  );
}

export default InputBox;