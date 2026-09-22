import React, { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Send, Users, MessageCircle, Loader2, Trash2, Plus, UserPlus, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function TeamChat() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  // activeChat: 'team' | user.id | 'group:<groupId>'
  const [activeChat, setActiveChat] = useState('team');
  const [sending, setSending] = useState(false);
  const [unreadMap, setUnreadMap] = useState({});
  const [showGroupForm, setShowGroupForm] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState([]);
  const messagesEndRef = useRef(null);
  const markedRef = useRef(new Set());

  // Load users list
  useEffect(() => {
    if (!currentUser) return;
    base44.entities.User.list()
      .then(allUsers => setUsers(allUsers.filter(x => x.id !== currentUser.id)))
      .catch(() => {});
  }, [currentUser]);

  const loadGroups = useCallback(async () => {
    if (!currentUser) return;
    try {
      const allGroups = await base44.entities.ChatGroup.list('-created_date', 200);
      // Only show groups where current user is a member
      const myGroups = allGroups.filter(g => {
        const members = (g.mitglieder || '').split(',').filter(Boolean);
        return members.includes(currentUser.id) || g.erstellt_von === currentUser.id;
      });
      setGroups(myGroups);
    } catch (e) {
      console.error('Failed to load groups', e);
    }
  }, [currentUser]);

  // Load messages
  const loadMessages = useCallback(async () => {
    if (!currentUser) return;
    try {
      const [team, direct, group] = await Promise.all([
        base44.entities.ChatMessage.filter({ is_direct: false }, 'created_date', 500),
        base44.entities.ChatMessage.filter({ is_direct: true }, 'created_date', 500),
        base44.entities.ChatMessage.filter({ group_id: { $ne: '' } }, 'created_date', 500),
      ]);
      const myDirect = direct.filter(m =>
        m.sender_id === currentUser.id || m.empfaenger_id === currentUser.id
      );
      // Only group messages for groups the user is a member of
      const myGroupIds = groups.map(g => g.id);
      const myGroup = group.filter(m =>
        m.group_id && myGroupIds.includes(m.group_id)
      );
      setMessages([...team, ...myDirect, ...myGroup].sort((a, b) =>
        (a.created_date || '').localeCompare(b.created_date || '')
      ));

      // Compute unread counts
      const unread = {};
      const isUnread = (m) => {
        if (m.sender_id === currentUser.id) return false;
        const readBy = (m.gelesen_von || '').split(',').filter(Boolean);
        return !readBy.includes(currentUser.id);
      };
      team.forEach(m => { if (isUnread(m)) unread['team'] = (unread['team'] || 0) + 1; });
      direct.forEach(m => {
        if (m.empfaenger_id === currentUser.id && isUnread(m)) {
          unread[m.sender_id] = (unread[m.sender_id] || 0) + 1;
        }
      });
      group.forEach(m => {
        if (myGroupIds.includes(m.group_id) && isUnread(m)) {
          unread['group:' + m.group_id] = (unread['group:' + m.group_id] || 0) + 1;
        }
      });
      setUnreadMap(unread);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [currentUser, groups]);

  useEffect(() => { loadMessages(); }, [loadMessages]);
  useEffect(() => { loadGroups(); }, [loadGroups]);

  // Realtime subscription
  useEffect(() => {
    if (!currentUser) return;
    const unsub = base44.entities.ChatMessage.subscribe(() => loadMessages());
    const unsubGroups = base44.entities.ChatGroup.subscribe(() => loadGroups());
    return () => { unsub(); unsubGroups(); };
  }, [currentUser, loadMessages, loadGroups]);

  // Polling fallback
  useEffect(() => {
    if (!currentUser) return;
    const interval = setInterval(() => { loadMessages(); loadGroups(); }, 15000);
    return () => clearInterval(interval);
  }, [currentUser, loadMessages, loadGroups]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeChat]);

  // Mark messages as read
  const markRead = useCallback(async () => {
    if (!currentUser) return;
    const relevant = messages.filter(m => {
      if (m.sender_id === currentUser.id) return false;
      if (markedRef.current.has(m.id)) return false;
      if (activeChat === 'team') return !m.is_direct && !m.group_id;
      if (activeChat.startsWith('group:')) {
        const gid = activeChat.slice(6);
        return m.group_id === gid;
      }
      return m.is_direct && (m.sender_id === activeChat || m.empfaenger_id === activeChat);
    });
    if (relevant.length === 0) return;
    for (const m of relevant) {
      const readBy = (m.gelesen_von || '').split(',').filter(Boolean);
      if (!readBy.includes(currentUser.id)) {
        readBy.push(currentUser.id);
        markedRef.current.add(m.id);
        await base44.entities.ChatMessage.update(m.id, { gelesen_von: readBy.join(',') });
      }
    }
    setUnreadMap(prev => ({ ...prev, [activeChat]: 0 }));
  }, [messages, activeChat, currentUser]);

  useEffect(() => {
    const t = setTimeout(markRead, 800);
    return () => clearTimeout(t);
  }, [markRead]);

  const send = async () => {
    const text = input.trim();
    if (!text || !currentUser) return;
    setSending(true);
    try {
      const msg = {
        text,
        sender_id: currentUser.id,
        sender_name: currentUser.full_name || currentUser.email,
        sender_email: currentUser.email,
        gelesen_von: currentUser.id,
      };
      if (activeChat === 'team') {
        msg.is_direct = false;
        msg.empfaenger_id = '';
      } else if (activeChat.startsWith('group:')) {
        msg.group_id = activeChat.slice(6);
        msg.is_direct = false;
        msg.empfaenger_id = '';
      } else {
        msg.is_direct = true;
        msg.empfaenger_id = activeChat;
      }
      await base44.entities.ChatMessage.create(msg);
      setInput('');
      loadMessages();
    } catch (e) {
      alert('Nachricht konnte nicht gesendet werden.');
    }
    setSending(false);
  };

  const del = async (id) => {
    if (!confirm('Nachricht löschen?')) return;
    await base44.entities.ChatMessage.delete(id);
    loadMessages();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const createGroup = async () => {
    const name = newGroupName.trim();
    if (!name || selectedMembers.length === 0 || !currentUser) return;
    try {
      const memberIds = [...selectedMembers, currentUser.id];
      const memberNames = [
        ...selectedMembers.map(id => users.find(u => u.id === id)?.full_name || users.find(u => u.id === id)?.email || 'Unbekannt'),
        currentUser.full_name || currentUser.email,
      ];
      await base44.entities.ChatGroup.create({
        name,
        mitglieder: memberIds.join(','),
        mitglieder_namen: memberNames.join(', '),
        erstellt_von: currentUser.id,
        erstellt_von_name: currentUser.full_name || currentUser.email,
      });
      setNewGroupName('');
      setSelectedMembers([]);
      setShowGroupForm(false);
      loadGroups();
    } catch (e) {
      alert('Gruppe konnte nicht erstellt werden.');
    }
  };

  const deleteGroup = async (groupId) => {
    if (!confirm('Gruppe löschen? Alle Nachrichten in dieser Gruppe werden ebenfalls gelöscht.')) return;
    try {
      await base44.entities.ChatMessage.deleteMany({ group_id: groupId });
      await base44.entities.ChatGroup.delete(groupId);
      if (activeChat === 'group:' + groupId) setActiveChat('team');
      loadGroups();
      loadMessages();
    } catch (e) {
      alert('Gruppe konnte nicht gelöscht werden.');
    }
  };

  if (!currentUser) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 text-teal-500 animate-spin" /></div>;

  // Filter messages for active chat
  const visibleMessages = messages.filter(m => {
    if (activeChat === 'team') return !m.is_direct && !m.group_id;
    if (activeChat.startsWith('group:')) {
      const gid = activeChat.slice(6);
      return m.group_id === gid;
    }
    if (!m.is_direct || m.group_id) return false;
    return (m.sender_id === currentUser.id && m.empfaenger_id === activeChat) ||
           (m.sender_id === activeChat && m.empfaenger_id === currentUser.id);
  });

  const getGroupName = (gid) => groups.find(g => g.id === gid)?.name || 'Gruppe';
  const activeChatName = activeChat === 'team'
    ? 'Team-Chat (alle)'
    : activeChat.startsWith('group:')
      ? getGroupName(activeChat.slice(6))
      : users.find(u => u.id === activeChat)?.full_name || users.find(u => u.id === activeChat)?.email || 'Direktnachricht';

  const formatTime = (d) => {
    if (!d) return '';
    try {
      return new Date(d).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    } catch { return ''; }
  };

  const SidebarButton = ({ active, onClick, icon, label, unread, trailing }) => (
    <button onClick={onClick}
      className={cn("flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm font-medium transition-all",
        active ? "bg-teal-600 text-white" : "text-slate-600 hover:bg-slate-100")}>
      {icon}
      <span className="truncate flex-1 text-left">{label}</span>
      {unread > 0 && (
        <span className="bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">{unread}</span>
      )}
      {trailing}
    </button>
  );

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="mb-4">
        <h1 className="text-xl font-bold text-slate-900">Team-Chat</h1>
        <p className="text-xs text-slate-500 mt-0.5">Nachrichten austauschen mit dem gesamten Team, einzelnen Personen oder in Gruppen</p>
      </div>

      <div className="flex bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden h-[calc(100vh-180px)] min-h-[400px]">
        {/* Sidebar */}
        <div className="w-56 border-r border-slate-100 flex flex-col bg-slate-50/50 shrink-0 hidden sm:flex">
          <div className="px-3 py-3 border-b border-slate-100 flex items-center justify-between">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Chats</p>
            <button onClick={() => setShowGroupForm(p => !p)} title="Neue Gruppe"
              className="p-1 rounded hover:bg-slate-200 text-slate-500 hover:text-teal-600">
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Group creation form */}
          {showGroupForm && (
            <div className="px-3 py-3 border-b border-slate-100 bg-white space-y-2">
              <input value={newGroupName} onChange={e => setNewGroupName(e.target.value)}
                placeholder="Gruppenname"
                className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-teal-400" />
              <div className="max-h-32 overflow-y-auto space-y-0.5">
                {users.map(u => (
                  <label key={u.id} className="flex items-center gap-2 px-1 py-0.5 cursor-pointer hover:bg-slate-50 rounded">
                    <input type="checkbox" checked={selectedMembers.includes(u.id)}
                      onChange={e => {
                        if (e.target.checked) setSelectedMembers(p => [...p, u.id]);
                        else setSelectedMembers(p => p.filter(id => id !== u.id));
                      }}
                      className="w-3.5 h-3.5 rounded" />
                    <span className="text-xs text-slate-700 truncate">{u.full_name || u.email}</span>
                  </label>
                ))}
              </div>
              <div className="flex gap-1.5">
                <button onClick={createGroup}
                  disabled={!newGroupName.trim() || selectedMembers.length === 0}
                  className="flex-1 bg-teal-600 text-white px-2 py-1.5 rounded-lg text-xs font-medium hover:bg-teal-700 disabled:opacity-50">
                  Erstellen
                </button>
                <button onClick={() => { setShowGroupForm(false); setNewGroupName(''); setSelectedMembers([]); }}
                  className="px-2 py-1.5 rounded-lg text-xs text-slate-500 hover:bg-slate-100">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
            <SidebarButton active={activeChat === 'team'} onClick={() => setActiveChat('team')}
              icon={<Users className="w-4 h-4 shrink-0" />} label="Team" unread={unreadMap['team']} />

            {/* Groups */}
            {groups.length > 0 && (
              <>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest px-3 pt-3 pb-1">Gruppen</p>
                {groups.map(g => (
                  <div key={g.id} className="relative group/g">
                    <SidebarButton active={activeChat === 'group:' + g.id} onClick={() => setActiveChat('group:' + g.id)}
                      icon={<div className="w-4 h-4 rounded bg-violet-100 flex items-center justify-center shrink-0">
                        <Users className="w-2.5 h-2.5 text-violet-600" />
                      </div>}
                      label={g.name} unread={unreadMap['group:' + g.id]}
                      trailing={
                        (g.erstellt_von === currentUser.id || currentUser.role === 'admin') ? (
                          <button onClick={(e) => { e.stopPropagation(); deleteGroup(g.id); }}
                            className="opacity-0 group-hover/g:opacity-100 p-0.5 rounded hover:bg-white/20 transition-opacity">
                            <Trash2 className="w-3 h-3 text-slate-400 group-hover/g:text-red-400" />
                          </button>
                        ) : null
                      }
                    />
                  </div>
                ))}
              </>
            )}

            {/* Direct messages */}
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest px-3 pt-3 pb-1">Personen</p>
            {users.map(u => (
              <SidebarButton key={u.id} active={activeChat === u.id} onClick={() => setActiveChat(u.id)}
                icon={<div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-600 shrink-0">
                  {(u.full_name || u.email || '?').charAt(0).toUpperCase()}
                </div>}
                label={u.full_name || u.email} unread={unreadMap[u.id]} />
            ))}
          </div>
        </div>

        {/* Chat area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
            {activeChat === 'team' ? <Users className="w-4 h-4 text-teal-600" />
              : activeChat.startsWith('group:') ? <Users className="w-4 h-4 text-violet-600" />
              : <MessageCircle className="w-4 h-4 text-teal-600" />}
            <h2 className="text-sm font-semibold text-slate-900 truncate flex-1">{activeChatName}</h2>
            {activeChat.startsWith('group:') && groups.find(g => g.id === activeChat.slice(6)) && (
              <span className="text-xs text-slate-400 truncate hidden sm:inline">
                {groups.find(g => g.id === activeChat.slice(6))?.mitglieder_namen || ''}
              </span>
            )}
          </div>

          {/* Mobile chat switcher */}
          <div className="sm:hidden border-b border-slate-100 px-3 py-2 flex gap-2 overflow-x-auto">
            <button onClick={() => setActiveChat('team')}
              className={cn("px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap shrink-0",
                activeChat === 'team' ? "bg-teal-600 text-white" : "bg-slate-100 text-slate-600")}>
              Team
            </button>
            {groups.map(g => (
              <button key={g.id} onClick={() => setActiveChat('group:' + g.id)}
                className={cn("px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap shrink-0",
                  activeChat === 'group:' + g.id ? "bg-violet-600 text-white" : "bg-slate-100 text-slate-600")}>
                {g.name}
              </button>
            ))}
            {users.map(u => (
              <button key={u.id} onClick={() => setActiveChat(u.id)}
                className={cn("px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap shrink-0",
                  activeChat === u.id ? "bg-teal-600 text-white" : "bg-slate-100 text-slate-600")}>
                {(u.full_name || u.email || '').split(' ')[0]}
              </button>
            ))}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2 bg-slate-50/30">
            {loading ? (
              <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-slate-300 animate-spin" /></div>
            ) : visibleMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <MessageCircle className="w-8 h-8 mb-2 text-slate-200" />
                <p className="text-sm">Noch keine Nachrichten. Schreibe die erste!</p>
              </div>
            ) : (
              visibleMessages.map(m => {
                const isMine = m.sender_id === currentUser.id;
                const showSender = !isMine && (activeChat === 'team' || activeChat.startsWith('group:'));
                return (
                  <div key={m.id} className={cn("flex group", isMine ? "justify-end" : "justify-start")}>
                    <div className={cn("max-w-[75%] rounded-2xl px-3 py-2 text-sm shadow-sm",
                      isMine ? "bg-teal-600 text-white rounded-br-sm" : "bg-white border border-slate-100 text-slate-800 rounded-bl-sm")}>
                      {showSender && (
                        <p className={cn("text-[11px] font-semibold mb-0.5",
                          activeChat.startsWith('group:') ? "text-violet-600" : "text-teal-600")}>
                          {m.sender_name || 'Unbekannt'}
                        </p>
                      )}
                      <p className="whitespace-pre-wrap break-words">{m.text}</p>
                      <div className={cn("flex items-center gap-1 mt-0.5", isMine ? "justify-end" : "justify-start")}>
                        <span className={cn("text-[10px]", isMine ? "text-teal-100" : "text-slate-400")}>{formatTime(m.created_date)}</span>
                        {isMine && (
                          <button onClick={() => del(m.id)}
                            className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-white/20 transition-opacity">
                            <Trash2 className="w-3 h-3 text-teal-100" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-slate-100 p-3 flex items-center gap-2 bg-white">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={sending ? 'Wird gesendet…' : `Nachricht an ${activeChatName}…`}
              disabled={sending}
              className="flex-1 border border-slate-200 rounded-xl px-4 py-2 text-sm outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-400 disabled:opacity-50"
            />
            <button onClick={send} disabled={sending || !input.trim()}
              className="flex items-center justify-center w-10 h-10 bg-teal-600 text-white rounded-xl hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed shrink-0">
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}