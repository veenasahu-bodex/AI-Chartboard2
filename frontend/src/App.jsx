import { useState } from "react";
import Sidebar from "./components/Sidebar";
import ChatWindow from "./components/ChatWindow";
import "./App.css";

// ======================================================
// CREATE NEW CHAT
// ======================================================

const createChat = () => {
  return {
    id: Date.now() + Math.random(),
    title: "New Chat",
    messages: [],
    fileName: "",
    fileContext: "",
    fileId: null,
    fileType: "",
    fileSize: 0,
  };
};

// ======================================================
// APP
// ======================================================

function App() {
  const [initialChat] = useState(() => createChat());

  const [chats, setChats] = useState([
    initialChat,
  ]);

  const [activeChatId, setActiveChatId] = useState(
    initialChat.id
  );

  // ====================================================
  // ACTIVE CHAT
  // ====================================================

  const activeChat = chats.find(
    (chat) => chat.id === activeChatId
  );

  // ====================================================
  // UPDATE CHAT
  // ====================================================

  const updateChat = (updatedChat) => {
    setChats((previousChats) =>
      previousChats.map((chat) => {
        if (chat.id !== updatedChat.id) {
          return chat;
        }

        let title = chat.title;

        // First user message becomes chat title
        if (
          (!title || title === "New Chat") &&
          updatedChat.messages?.length > 0
        ) {
          const firstUserMessage =
            updatedChat.messages.find(
              (message) =>
                message.role === "user" &&
                message.content?.trim()
            );

          if (firstUserMessage) {
            const originalText =
              firstUserMessage.content.trim();

            title = originalText
              .replace(/\s+/g, " ")
              .slice(0, 35);

            if (originalText.length > 35) {
              title += "...";
            }
          }
        }

        return {
          ...updatedChat,
          title,
        };
      })
    );
  };

  // ====================================================
  // NEW CHAT
  // ====================================================

  const handleNewChat = () => {
    const newChat = createChat();

    setChats((previousChats) => [
      ...previousChats,
      newChat,
    ]);

    setActiveChatId(newChat.id);
  };

  // ====================================================
  // DELETE CHAT
  // ====================================================

  const handleDeleteChat = (chatId) => {
    setChats((previousChats) => {
      const remainingChats =
        previousChats.filter(
          (chat) => chat.id !== chatId
        );

      if (chatId !== activeChatId) {
        return remainingChats;
      }

      if (remainingChats.length > 0) {
        const nextChat =
          remainingChats[
            remainingChats.length - 1
          ];

        setActiveChatId(nextChat.id);

        return remainingChats;
      }

      const newChat = createChat();

      setActiveChatId(newChat.id);

      return [newChat];
    });
  };

  // ====================================================
  // CLEAR ALL CHATS
  // ====================================================

  const handleClearChats = () => {
    const newChat = createChat();

    setChats([newChat]);
    setActiveChatId(newChat.id);
  };

  // ====================================================
  // ACTIVE CHAT CHECK
  // ====================================================

  if (!activeChat) {
    return null;
  }

  // ====================================================
  // UI
  // ====================================================

  return (
    <div className="app">
      <Sidebar
        chats={chats}
        activeChatId={activeChatId}
        setActiveChatId={setActiveChatId}
        onNewChat={handleNewChat}
        onDeleteChat={handleDeleteChat}
        onClearChats={handleClearChats}
      />

      <ChatWindow
        chat={activeChat}
        updateChat={updateChat}
      />
    </div>
  );
}

export default App;