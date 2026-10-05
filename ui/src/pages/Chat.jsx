import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabase';
import { Paperclip, Send, X, Loader } from 'lucide-react';
import '../App.css';

const Chat = () => {
  const [contacts, setContacts] = useState([]);
  const [activeContactNumber, setActiveContactNumber] = useState(null);
  const [messages, setMessages] = useState([]);
  const fileInputRef = useRef(null);
  
  useEffect(() => {
    const fetchContacts = async () => {
      const { data } = await supabase
        .from('whatsapp_messages_amit')
        .select('contact_number, contact_name, created_at')
        .order('created_at', { ascending: false });
        
      if (data) {
        const uniqueContactsMap = new Map();
        data.forEach(msg => {
          if (!uniqueContactsMap.has(msg.contact_number)) {
            uniqueContactsMap.set(msg.contact_number, {
              number: msg.contact_number,
              name: msg.contact_name || msg.contact_number,
              lastMessageAt: new Date(msg.created_at)
            });
          }
        });
        const uniqueContacts = Array.from(uniqueContactsMap.values());
        setContacts(uniqueContacts);
        if (uniqueContacts.length > 0 && !activeContactNumber) {
          setActiveContactNumber(uniqueContacts[0].number);
        }
      }
    };
    fetchContacts();

    const subscription = supabase
      .channel('public:whatsapp_messages_amit')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'whatsapp_messages_amit' }, fetchContacts)
      .subscribe();

    return () => { supabase.removeChannel(subscription); };
  }, []);

  useEffect(() => {
    if (!activeContactNumber) return;
    
    const fetchMessages = async () => {
      const { data } = await supabase
        .from('whatsapp_messages_amit')
        .select('*')
        .eq('contact_number', activeContactNumber)
        .order('created_at', { ascending: true });
      if (data) setMessages(data);
    };
    
    fetchMessages();
    
    const msgSub = supabase
      .channel(`messages-${activeContactNumber}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'whatsapp_messages_amit', filter: `contact_number=eq.${activeContactNumber}` }, payload => {
        setMessages(prev => [...prev, payload.new]);
      })
      .subscribe();
      
    return () => { supabase.removeChannel(msgSub); };
  }, [activeContactNumber]);

  const activeContact = contacts.find(c => c.number === activeContactNumber);
  const is24hrWindowOpen = activeContact ? (new Date() - activeContact.lastMessageAt) < 24 * 60 * 60 * 1000 : false;

  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [isSending, setIsSending] = useState(false);
  
  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files).map(file => ({
        file,
        id: Math.random().toString(36).substr(2, 9),
        previewUrl: URL.createObjectURL(file),
        status: 'pending'
      }));
      setAttachments(prev => [...prev, ...newFiles]);
    }
  };
  
  const removeAttachment = (id) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  };
  
  const uploadInBatches = async (files, batchSize = 4) => {
    let results = [];
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      const batchPromises = batch.map(async (att) => {
        setAttachments(prev => prev.map(a => a.id === att.id ? {...a, status: 'uploading'} : a));
        
        const formData = new FormData();
        formData.append('file', att.file);
        formData.append('bucket_name', 'whatsapp-media-bucket-amit');
        formData.append('folder_path', 'whatsapp_outbound/');
        
        try {
          const res = await fetch('https://us-central1-learning-project-505117.cloudfunctions.net/gcs-upload', {
            method: 'POST',
            body: formData
          });
          const data = await res.json();
          if (data.url) {
            setAttachments(prev => prev.map(a => a.id === att.id ? {...a, status: 'done'} : a));
            return { ...att, url: data.url };
          }
        } catch (e) {
          console.error("Upload failed", e);
        }
        return { ...att, url: null };
      });
      const batchResults = await Promise.all(batchPromises);
      results = [...results, ...batchResults];
    }
    return results;
  };

  const handleSend = async () => {
    if (!text.trim() && attachments.length === 0) return;
    setIsSending(true);
    
    let uploadedAttachments = [];
    if (attachments.length > 0) {
      uploadedAttachments = await uploadInBatches(attachments, 4);
    }
    
    const sendToMeta = async (payload) => {
      await fetch('https://us-central1-learning-project-505117.cloudfunctions.net/whatsapp-send-amit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    };
    
    if (text.trim()) {
      await sendToMeta({
        to: activeContactNumber,
        type: 'text',
        text: text
      });
    }
    
    for (const att of uploadedAttachments) {
      if (att.url) {
        let mediaType = 'document';
        if (att.file.type.startsWith('image/')) mediaType = 'image';
        else if (att.file.type.startsWith('video/')) mediaType = 'video';
        else if (att.file.type.startsWith('audio/')) mediaType = 'audio';
        
        await sendToMeta({
          to: activeContactNumber,
          type: mediaType,
          media_url: att.url
        });
      }
    }
    
    setText("");
    setAttachments([]);
    setIsSending(false);
  };
  
  return (
    <div className="chat-container">
      <div className="sidebar">
        <div className="sidebar-header">
          <h2>Chats</h2>
        </div>
        <div className="contact-list">
          {contacts.map(c => (
            <div 
              key={c.number} 
              className={`contact-item ${c.number === activeContactNumber ? 'active' : ''}`}
              onClick={() => setActiveContactNumber(c.number)}
            >
              <div className="contact-avatar">{c.name.charAt(0).toUpperCase()}</div>
              <div className="contact-info">
                <div className="contact-name">{c.name}</div>
                <div className="contact-preview">{c.number}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      <div className="chat-area">
        {activeContact ? (
          <>
            <div className="chat-header">
              <div className="header-info">
                <div className="contact-avatar">{activeContact.name.charAt(0).toUpperCase()}</div>
                <div className="contact-details">
                  <div className="contact-name">{activeContact.name}</div>
                  <div className="contact-number">{activeContact.number}</div>
                </div>
              </div>
              {!is24hrWindowOpen && (
                <div className="warning-banner">
                  ⚠️ 24-hour window closed. You can only send template messages.
                </div>
              )}
            </div>
            
            <div className="message-list">
              {messages.map(m => (
                <div key={m.id} className={`message-wrapper ${m.direction}`}>
                  <div className="message-bubble">
                    {m.media_file_url ? (
                      <div className="message-media">
                        {m.message_type === 'image' ? <img src={m.media_file_url} /> : <a href={m.media_file_url} target="_blank">Attachment ({m.message_type})</a>}
                      </div>
                    ) : (
                      <div className="message-text">{m.message_text}</div>
                    )}
                    <div className="message-time">{new Date(m.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="chat-composer">
              {attachments.length > 0 && (
                <div className="attachments-preview">
                  {attachments.map(att => (
                    <div key={att.id} className="attachment-item">
                      {att.file.type.startsWith('image/') ? (
                         <img src={att.previewUrl} />
                      ) : (
                         <div className="doc-preview">{att.file.name.slice(-4)}</div>
                      )}
                      <button onClick={() => removeAttachment(att.id)} className="remove-att-btn"><X size={12} /></button>
                      {att.status === 'uploading' && <div className="att-overlay">Up...</div>}
                    </div>
                  ))}
                </div>
              )}
              <div className="composer-input-row">
                <button onClick={() => fileInputRef.current.click()} disabled={isSending} className="icon-btn">
                  <Paperclip size={20} />
                </button>
                <input type="file" ref={fileInputRef} multiple onChange={handleFileChange} style={{display: 'none'}} />
                <input 
                  type="text" 
                  className="composer-text-input" 
                  value={text} 
                  onChange={e => setText(e.target.value)} 
                  onKeyDown={e => e.key === 'Enter' && handleSend()}
                  placeholder="Type a message..." 
                  disabled={isSending}
                />
                <button onClick={handleSend} disabled={isSending || (!text.trim() && attachments.length === 0)} className="icon-btn send-btn">
                  {isSending ? <Loader className="spin" size={20}/> : <Send size={20} />}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="empty-state">Select a contact to start messaging</div>
        )}
      </div>
    </div>
  );
};

export default Chat;
