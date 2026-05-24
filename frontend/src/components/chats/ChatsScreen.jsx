import React, { useEffect, useState, useRef } from 'react';
import { Search, RefreshCw, Plus, X, Check, FolderPlus, Trash2 } from 'lucide-react';
import { api } from '../../utils/api';
import { useApp } from '../../store/AppContext';
import ChannelPage from '../discover/ChannelPage';

const COLORS = [
  '#2196F3','#E91E63','#4CAF50','#FF5722','#9C27B0',
  '#00BCD4','#FF9800','#009688','#F44336','#673AB7',
  '#3F51B5','#607D8B','#795548','#FF5252','#00E676',
];

function getInitials(name) {
  const words = (name || '').trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return (name || '??').slice(0, 2).toUpperCase();
}
function getColor(id) {
  return COLORS[Math.abs(Number(id) || 0) % COLORS.length];
}

// ── Folder storage ────────────────────────────────────────────────────────────
const FOLDERS_KEY = 'airbooks_folders_v1';

function loadFolders() {
  try { return JSON.parse(localStorage.getItem(FOLDERS_KEY) || '[]'); } catch { return []; }
}
function saveFolders(folders) {
  localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders));
}

// ── Chat card ─────────────────────────────────────────────────────────────────
function ChatCard({ chat, onTap, onLongPress, selected }) {
  const [imgFailed, setImgFailed] = useState(false);
  const color = getColor(chat.id);
  const ini = getInitials(chat.name);
  const pressTimer = useRef(null);

  const typeLabel = chat.type === 'channel' ? 'Channel'
    : (chat.type === 'group' || chat.type === 'supergroup') ? 'Group'
    : 'Chat';

  function handlePressStart() {
    pressTimer.current = setTimeout(() => onLongPress && onLongPress(), 500);
  }
  function handlePressEnd() {
    clearTimeout(pressTimer.current);
  }

  return (
    <button
      onPointerDown={handlePressStart}
      onPointerUp={handlePressEnd}
      onPointerLeave={handlePressEnd}
      onClick={onTap}
      style={{
        background: selected ? '#e8f0ff' : 'white',
        borderRadius: '16px', border: selected ? '2px solid #3478f6' : '2px solid transparent',
        cursor: 'pointer', padding: '0',
        display: 'flex', flexDirection: 'column', alignItems: 'stretch',
        boxShadow: '0 1px 6px rgba(0,0,0,0.09)',
        position: 'relative', overflow: 'hidden',
        WebkitTapHighlightColor: 'transparent',
        transition: 'border-color 0.15s',
      }}
    >
      {/* Square photo */}
      <div style={{ position: 'relative', width: '100%', paddingTop: '100%' }}>
        <div style={{
          position: 'absolute', inset: 0, background: color,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'white', fontWeight: '800', fontSize: '22px',
          borderRadius: '14px 14px 0 0',
        }}>
          {ini}
        </div>
        {!imgFailed && (
          <img src={api.chatPhotoUrl('user', chat.id)} alt=""
            onError={() => setImgFailed(true)}
            style={{
              position: 'absolute', inset: 0, width: '100%', height: '100%',
              objectFit: 'cover', borderRadius: '14px 14px 0 0',
            }} />
        )}
        {/* Checkmark overlay when selected */}
        {selected && (
          <div style={{
            position: 'absolute', inset: 0, background: 'rgba(52,120,246,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: '14px 14px 0 0',
          }}>
            <div style={{
              width: '28px', height: '28px', borderRadius: '50%',
              background: '#3478f6', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Check size={16} color="white" strokeWidth={3} />
            </div>
          </div>
        )}
      </div>

      {/* Text */}
      <div style={{ padding: '8px 8px 10px', textAlign: 'center' }}>
        <p style={{
          fontSize: '11px', fontWeight: '600', color: '#1c1c1e',
          margin: '0 0 5px', lineHeight: '1.3',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {chat.name}
        </p>
        <span style={{
          display: 'inline-block', fontSize: '9px', fontWeight: '600',
          color: '#8e8e93', background: '#f2f2f7', borderRadius: '5px', padding: '1px 7px',
        }}>
          {typeLabel}
        </span>
      </div>

      {/* Unread badge */}
      {chat.unread > 0 && !selected && (
        <div style={{
          position: 'absolute', top: '6px', right: '6px',
          background: '#3478f6', color: 'white', fontSize: '9px', fontWeight: '800',
          borderRadius: '8px', padding: '2px 5px', minWidth: '16px', textAlign: 'center',
        }}>
          {chat.unread > 99 ? '99+' : chat.unread}
        </div>
      )}
    </button>
  );
}

// ── Create folder modal ───────────────────────────────────────────────────────
function CreateFolderModal({ onClose, onCreate }) {
  const [name, setName] = useState('');
  const inputRef = useRef(null);
  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 100); }, []);

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 400,
      background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'white', borderRadius: '20px 20px 0 0', width: '100%',
        padding: '20px 20px calc(env(safe-area-inset-bottom,0px)+20px)',
      }}>
        <div style={{ width: '36px', height: '4px', background: '#e5e5ea', borderRadius: '2px', margin: '0 auto 20px' }} />
        <p style={{ fontWeight: '700', fontSize: '17px', color: '#1c1c1e', margin: '0 0 16px' }}>
          New Folder
        </p>
        <input
          ref={inputRef}
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && name.trim()) onCreate(name.trim()); }}
          placeholder="Folder name (e.g. Air, Study, Movies)"
          style={{
            width: '100%', boxSizing: 'border-box', background: '#f2f2f7',
            border: 'none', borderRadius: '12px', padding: '12px 14px',
            fontSize: '15px', color: '#1c1c1e', outline: 'none', marginBottom: '12px',
          }}
        />
        <button
          onClick={() => name.trim() && onCreate(name.trim())}
          disabled={!name.trim()}
          style={{
            width: '100%', padding: '14px', borderRadius: '14px', border: 'none',
            background: name.trim() ? '#3478f6' : '#e5e5ea',
            color: name.trim() ? 'white' : '#8e8e93',
            fontWeight: '700', fontSize: '15px', cursor: name.trim() ? 'pointer' : 'default',
          }}
        >
          Create Folder
        </button>
      </div>
    </div>
  );
}

// ── Add to folder sheet ───────────────────────────────────────────────────────
function AddToFolderSheet({ chat, folders, onClose, onSave }) {
  const [selected, setSelected] = useState(
    folders.filter(f => f.chatIds.includes(String(chat.id))).map(f => f.id)
  );

  function toggle(folderId) {
    setSelected(prev =>
      prev.includes(folderId) ? prev.filter(id => id !== folderId) : [...prev, folderId]
    );
  }

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 400,
      background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'white', borderRadius: '20px 20px 0 0', width: '100%',
        padding: '16px 16px calc(env(safe-area-inset-bottom,0px)+16px)',
        maxHeight: '70vh', overflowY: 'auto',
      }}>
        <div style={{ width: '36px', height: '4px', background: '#e5e5ea', borderRadius: '2px', margin: '0 auto 14px' }} />
        <p style={{ fontWeight: '700', fontSize: '16px', color: '#1c1c1e', margin: '0 0 4px' }}>
          Add to Folder
        </p>
        <p style={{ fontSize: '13px', color: '#8e8e93', margin: '0 0 16px' }}>
          {chat.name}
        </p>

        {folders.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#8e8e93', padding: '20px', fontSize: '14px' }}>
            No folders yet. Create one first.
          </p>
        ) : (
          folders.map(f => (
            <button key={f.id} onClick={() => toggle(f.id)} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              width: '100%', padding: '14px', background: selected.includes(f.id) ? '#e8f0ff' : '#f2f2f7',
              border: selected.includes(f.id) ? '1.5px solid #3478f640' : '1.5px solid transparent',
              borderRadius: '14px', cursor: 'pointer', marginBottom: '8px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '36px', height: '36px', borderRadius: '10px',
                  background: '#3478f615', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{ fontSize: '18px' }}>📁</span>
                </div>
                <div style={{ textAlign: 'left' }}>
                  <p style={{ fontWeight: '700', fontSize: '14px', color: '#1c1c1e', margin: 0 }}>{f.name}</p>
                  <p style={{ fontSize: '11px', color: '#8e8e93', margin: 0 }}>{f.chatIds.length} chats</p>
                </div>
              </div>
              {selected.includes(f.id) && <Check size={18} color="#3478f6" strokeWidth={2.5} />}
            </button>
          ))
        )}

        <button onClick={() => onSave(selected)} style={{
          width: '100%', padding: '14px', borderRadius: '14px', border: 'none',
          background: '#3478f6', color: 'white', fontWeight: '700', fontSize: '15px',
          cursor: 'pointer', marginTop: '4px',
        }}>
          Save
        </button>
      </div>
    </div>
  );
}

// ── Folder chip long-press menu ───────────────────────────────────────────────
function FolderMenu({ folder, onClose, onRename, onDelete }) {
  const [newName, setNewName] = useState(folder.name);
  const [renaming, setRenaming] = useState(false);

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 400,
      background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'white', borderRadius: '20px 20px 0 0', width: '100%',
        padding: '16px 16px calc(env(safe-area-inset-bottom,0px)+16px)',
      }}>
        <div style={{ width: '36px', height: '4px', background: '#e5e5ea', borderRadius: '2px', margin: '0 auto 14px' }} />
        <p style={{ fontWeight: '700', fontSize: '16px', color: '#1c1c1e', margin: '0 0 16px' }}>
          📁 {folder.name} <span style={{ fontSize: '13px', color: '#8e8e93', fontWeight: '400' }}>({folder.chatIds.length} chats)</span>
        </p>

        {renaming ? (
          <>
            <input value={newName} onChange={e => setNewName(e.target.value)} autoFocus
              style={{
                width: '100%', boxSizing: 'border-box', background: '#f2f2f7',
                border: 'none', borderRadius: '12px', padding: '12px 14px',
                fontSize: '15px', color: '#1c1c1e', outline: 'none', marginBottom: '10px',
              }} />
            <button onClick={() => newName.trim() && onRename(newName.trim())} style={{
              width: '100%', padding: '13px', borderRadius: '14px', border: 'none',
              background: '#3478f6', color: 'white', fontWeight: '700', fontSize: '15px', cursor: 'pointer',
            }}>Save Name</button>
          </>
        ) : (
          <>
            <button onClick={() => setRenaming(true)} style={{
              display: 'flex', alignItems: 'center', gap: '12px', width: '100%',
              padding: '14px', background: '#f2f2f7', border: 'none', borderRadius: '14px',
              cursor: 'pointer', marginBottom: '8px',
            }}>
              <FolderPlus size={18} color="#3478f6" />
              <span style={{ fontWeight: '600', fontSize: '14px', color: '#1c1c1e' }}>Rename Folder</span>
            </button>
            <button onClick={onDelete} style={{
              display: 'flex', alignItems: 'center', gap: '12px', width: '100%',
              padding: '14px', background: '#fff1f0', border: 'none', borderRadius: '14px',
              cursor: 'pointer',
            }}>
              <Trash2 size={18} color="#ff3b30" />
              <span style={{ fontWeight: '600', fontSize: '14px', color: '#ff3b30' }}>Delete Folder</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
const STATIC_FILTERS = [
  { key: 'all',     label: 'All' },
  { key: 'channel', label: 'Channels' },
  { key: 'group',   label: 'Groups' },
  { key: 'private', label: 'Private' },
];
const CACHE_KEY = 'airbooks_chats_v1';

export default function ChatsScreen() {
  const { state, actions } = useApp();
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [activeChat, setActiveChat] = useState(null);

  // Folders
  const [folders, setFolders] = useState(loadFolders);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [addToFolderChat, setAddToFolderChat] = useState(null);
  const [folderMenu, setFolderMenu] = useState(null); // folder object

  useEffect(() => {
    if (!state.isLoggedIn) return;
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
      if (cached?.chats?.length) actions.setChats(cached.chats);
    } catch {}
    refresh(state.userChats.length === 0);
  }, [state.isLoggedIn]);

  async function refresh(showSpinner = false) {
    if (showSpinner) setLoading(true);
    try {
      const res = await api.getChats();
      const chats = res.chats || [];
      actions.setChats(chats);
      localStorage.setItem(CACHE_KEY, JSON.stringify({ chats, ts: Date.now() }));
    } catch {}
    setLoading(false);
  }

  // Folder operations
  function createFolder(name) {
    const newFolder = { id: Date.now().toString(), name, chatIds: [] };
    const updated = [...folders, newFolder];
    setFolders(updated);
    saveFolders(updated);
    setShowCreateFolder(false);
    setFilter(newFolder.id); // Switch to new folder
  }

  function saveToFolders(chatId, selectedFolderIds) {
    const chatIdStr = String(chatId);
    const updated = folders.map(f => ({
      ...f,
      chatIds: selectedFolderIds.includes(f.id)
        ? [...new Set([...f.chatIds, chatIdStr])]
        : f.chatIds.filter(id => id !== chatIdStr),
    }));
    setFolders(updated);
    saveFolders(updated);
    setAddToFolderChat(null);
  }

  function renameFolder(folderId, newName) {
    const updated = folders.map(f => f.id === folderId ? { ...f, name: newName } : f);
    setFolders(updated);
    saveFolders(updated);
    setFolderMenu(null);
  }

  function deleteFolder(folderId) {
    const updated = folders.filter(f => f.id !== folderId);
    setFolders(updated);
    saveFolders(updated);
    setFolderMenu(null);
    if (filter === folderId) setFilter('all');
  }

  if (activeChat) {
    return <ChannelPage channel={activeChat} source="user" onBack={() => setActiveChat(null)} />;
  }

  // Filter chats
  const activeFolder = folders.find(f => f.id === filter);
  const visible = state.userChats.filter(c => {
    const q = search.toLowerCase();
    const matchSearch = !q
      || c.name.toLowerCase().includes(q)
      || (c.username || '').toLowerCase().includes(q);
    let matchFilter = true;
    if (filter === 'channel') matchFilter = c.type === 'channel';
    else if (filter === 'group') matchFilter = c.type === 'group' || c.type === 'supergroup';
    else if (filter === 'private') matchFilter = c.type === 'private' || c.type === 'bot';
    else if (activeFolder) matchFilter = activeFolder.chatIds.includes(String(c.id));
    return matchSearch && matchFilter;
  });

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#f2f2f7', overflow: 'hidden' }}>

      {/* Header */}
      <div style={{ flexShrink: 0, background: '#f2f2f7', padding: '50px 16px 10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <span style={{ fontSize: '26px', fontWeight: '800', color: '#1c1c1e' }}>Chats</span>
          {state.isLoggedIn && (
            <button onClick={() => refresh(true)} style={{
              width: '36px', height: '36px', borderRadius: '10px', background: 'white',
              border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center',
              justifyContent: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
            }}>
              <RefreshCw size={15} color="#3478f6"
                style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            </button>
          )}
        </div>

        {state.isLoggedIn && (
          <>
            <div style={{ position: 'relative', marginBottom: '10px' }}>
              <Search size={14} color="#8e8e93" style={{
                position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)',
              }} />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search chats..."
                style={{
                  width: '100%', boxSizing: 'border-box', background: 'white',
                  border: 'none', borderRadius: '12px', padding: '10px 12px 10px 36px',
                  fontSize: '14px', color: '#1c1c1e', outline: 'none',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                }} />
            </div>

            {/* Filter chips + create folder button */}
            <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', scrollbarWidth: 'none', alignItems: 'center' }}>
              {/* Static filters */}
              {STATIC_FILTERS.map(f => (
                <button key={f.key} onClick={() => setFilter(f.key)} style={{
                  flexShrink: 0, padding: '5px 14px', borderRadius: '16px',
                  border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '12px',
                  background: filter === f.key ? '#3478f6' : 'white',
                  color: filter === f.key ? 'white' : '#636366',
                  boxShadow: filter === f.key ? '0 2px 6px rgba(52,120,246,0.25)' : '0 1px 3px rgba(0,0,0,0.08)',
                }}>
                  {f.label}
                </button>
              ))}

              {/* Custom folder chips */}
              {folders.map(f => (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  onContextMenu={e => { e.preventDefault(); setFolderMenu(f); }}
                  onPointerDown={(() => {
                    let t;
                    return () => { t = setTimeout(() => setFolderMenu(f), 600); };
                  })()}
                  onPointerUp={(() => {
                    let t;
                    return () => clearTimeout(t);
                  })()}
                  style={{
                    flexShrink: 0, padding: '5px 12px', borderRadius: '16px',
                    border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '12px',
                    display: 'flex', alignItems: 'center', gap: '4px',
                    background: filter === f.id ? '#5856d6' : 'white',
                    color: filter === f.id ? 'white' : '#636366',
                    boxShadow: filter === f.id ? '0 2px 6px rgba(88,86,214,0.25)' : '0 1px 3px rgba(0,0,0,0.08)',
                  }}
                >
                  📁 {f.name}
                </button>
              ))}

              {/* Create folder button */}
              <button onClick={() => setShowCreateFolder(true)} style={{
                flexShrink: 0, width: '28px', height: '28px', borderRadius: '50%',
                background: 'white', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
              }}>
                <Plus size={14} color="#3478f6" />
              </button>
            </div>
          </>
        )}
      </div>

      {/* Grid */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '10px 12px 100px' }}>
        {!state.isLoggedIn ? (
          <div style={{ textAlign: 'center', padding: '60px 24px' }}>
            <p style={{ fontSize: '17px', fontWeight: '600', color: '#1c1c1e', margin: '0 0 8px' }}>
              Sign in with Telegram
            </p>
            <p style={{ fontSize: '14px', color: '#8e8e93', lineHeight: '1.5', margin: 0 }}>
              Browse your channels, groups and chats
            </p>
          </div>
        ) : loading && visible.length === 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} style={{ background: 'white', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 1px 5px rgba(0,0,0,0.06)' }}>
                <div style={{ width: '100%', paddingTop: '100%', background: '#e5e5ea' }} />
                <div style={{ padding: '8px 8px 10px' }}>
                  <div style={{ height: '10px', background: '#e5e5ea', borderRadius: '5px', marginBottom: '6px' }} />
                  <div style={{ height: '14px', background: '#e5e5ea', borderRadius: '7px', width: '55%', margin: '0 auto' }} />
                </div>
              </div>
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 24px' }}>
            <p style={{ fontSize: '15px', fontWeight: '500', color: '#8e8e93', margin: '0 0 8px' }}>
              {activeFolder ? `No chats in "${activeFolder.name}"` : 'No chats found'}
            </p>
            {activeFolder && (
              <p style={{ fontSize: '13px', color: '#8e8e93', margin: 0 }}>
                Long press any chat card to add it to this folder
              </p>
            )}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
            {visible.map(chat => (
              <ChatCard
                key={chat.id}
                chat={chat}
                selected={false}
                onTap={() => setActiveChat(chat)}
                onLongPress={() => setAddToFolderChat(chat)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      {showCreateFolder && (
        <CreateFolderModal onClose={() => setShowCreateFolder(false)} onCreate={createFolder} />
      )}
      {addToFolderChat && (
        <AddToFolderSheet
          chat={addToFolderChat}
          folders={folders}
          onClose={() => setAddToFolderChat(null)}
          onSave={(ids) => saveToFolders(addToFolderChat.id, ids)}
        />
      )}
      {folderMenu && (
        <FolderMenu
          folder={folderMenu}
          onClose={() => setFolderMenu(null)}
          onRename={(name) => renameFolder(folderMenu.id, name)}
          onDelete={() => deleteFolder(folderMenu.id)}
        />
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
