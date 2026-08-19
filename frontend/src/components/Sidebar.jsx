import novaBot from "../assets/nova-bot.jpeg";
import "./Sidebar.css";

function Sidebar({
  chats = [],
  activeChatId,
  setActiveChatId,
  onNewChat,
  onDeleteChat,
  onClearChats,
}) {
  return (
    <aside className="sidebar">
      {/* HEADER */}
      <div className="sidebar-header">
        <img
          src={novaBot}
          alt="Nova"
          className="nova-logo-image"
        />

        <div className="nova-brand">
          <h2>Nova</h2>
          <span>AI Assistant</span>
        </div>
      </div>

      {/* NEW CHAT */}
      <button
        type="button"
        className="new-chat-button"
        onClick={onNewChat}
      >
        <span className="plus-icon">+</span>
        <span>New Chat</span>
      </button>

      {/* HISTORY HEADER */}
      <div className="history-header">
        <span>CHAT HISTORY</span>

        <span className="chat-count">
          {chats.length}
        </span>
      </div>

      {/* CHAT HISTORY */}
      <div className="chat-history">
        {chats.length === 0 ? (
          <div className="empty-history">
            No chats yet
          </div>
        ) : (
          chats.map((chat) => (
            <div
              key={chat.id}
              className={`history-item ${
                chat.id === activeChatId
                  ? "active"
                  : ""
              }`}
              onClick={() =>
                setActiveChatId(chat.id)
              }
            >
              <div className="history-icon">
                💬
              </div>

              <div className="history-title">
                {chat.title || "New Chat"}
              </div>

              <button
                type="button"
                className="delete-chat"
                onClick={(event) => {
                  event.stopPropagation();
                  onDeleteChat(chat.id);
                }}
                title="Delete chat"
              >
                🗑
              </button>
            </div>
          ))
        )}
      </div>

      {/* BOTTOM */}
      <div className="sidebar-bottom">
        <button
          type="button"
          className="clear-button"
          onClick={onClearChats}
          disabled={chats.length === 0}
        >
          🗑
          <span>Clear All Chats</span>
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;