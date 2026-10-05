import React, { useState, useEffect } from 'react';
import { Send, UploadCloud, Edit3, Trash2, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const TEMPLATES_API_URL = "https://asia-southeast1-learning-project-505117.cloudfunctions.net/whatsapp-templates-amit";

const ManageTemplates = () => {
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [targetNumber, setTargetNumber] = useState('');
  const [variables, setVariables] = useState({});
  const [mediaFile, setMediaFile] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const navigate = useNavigate();
  
  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const res = await fetch(TEMPLATES_API_URL);
      const data = await res.json();
      if (data.data) {
        setTemplates(data.data);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const handleSelect = (tpl) => {
    setSelectedTemplate(tpl);
    setVariables({});
    setMediaFile(null);
  };

  const extractVars = (text) => {
    const regex = /\{\{(\d+)\}\}/g;
    let match;
    const vars = new Set();
    while ((match = regex.exec(text)) !== null) {
      vars.add(match[1]);
    }
    return Array.from(vars);
  };

  const getBodyVars = (tpl) => {
    const bodyComp = tpl.components.find(c => c.type === 'BODY');
    return bodyComp ? extractVars(bodyComp.text || '') : [];
  };

  const requiresMedia = (tpl) => {
    const header = tpl.components.find(c => c.type === 'HEADER');
    return header && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(header.format);
  };

  const handleEdit = (tpl) => {
    navigate('/create-template', { state: { editTemplate: tpl } });
  };

  const handleDelete = async (tpl) => {
    if (!window.confirm(`Delete template ${tpl.name}?`)) return;
    try {
      await fetch(TEMPLATES_API_URL, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: tpl.name })
      });
      fetchTemplates();
      if (selectedTemplate && selectedTemplate.name === tpl.name) {
        setSelectedTemplate(null);
      }
    } catch (e) {
      alert("Failed to delete.");
    }
  };

  const handleSend = async () => {
    if (!targetNumber) return alert('Enter target phone number');
    setIsSending(true);
    
    // Process Media Upload if required
    let mediaUrl = null;
    if (requiresMedia(selectedTemplate) && mediaFile) {
       const formData = new FormData();
       formData.append('file', mediaFile);
       formData.append('bucket_name', 'whatsapp-media-bucket-amit');
       formData.append('folder_path', 'whatsapp_outbound/');
       
       const res = await fetch('https://us-central1-learning-project-505117.cloudfunctions.net/gcs-upload', {
         method: 'POST',
         body: formData
       });
       const data = await res.json();
       mediaUrl = data.url;
    }

    const templateComponents = [];
    
    // Add Header Media Component if present
    if (mediaUrl) {
       const headerFormat = selectedTemplate.components.find(c => c.type === 'HEADER').format;
       templateComponents.push({
         type: 'header',
         parameters: [
           {
             type: headerFormat.toLowerCase(),
             [headerFormat.toLowerCase()]: { link: mediaUrl }
           }
         ]
       });
    }

    // Add Body Variables Component if present
    const bVars = getBodyVars(selectedTemplate);
    if (bVars.length > 0) {
       const params = bVars.map(v => ({
         type: 'text',
         text: variables[v] || ''
       }));
       templateComponents.push({
         type: 'body',
         parameters: params
       });
    }

    const payload = {
      to: targetNumber,
      type: 'template',
      template_name: selectedTemplate.name,
      template_language: selectedTemplate.language
    };

    if (templateComponents.length > 0) {
      payload.template_components = templateComponents;
    }

    try {
      const res = await fetch('https://us-central1-learning-project-505117.cloudfunctions.net/whatsapp-send-amit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        alert("Template sent successfully!");
      } else {
        alert("Error: " + JSON.stringify(data.error));
      }
    } catch(e) {
      alert("Request failed");
    }
    
    setIsSending(false);
  };

  const getStatusColor = (status) => {
    switch(status?.toLowerCase()) {
      case 'approved': return '#00a884';
      case 'rejected': return '#e53935';
      case 'pending': return '#fb8c00';
      default: return '#757575';
    }
  };

  return (
    <div className="manage-container">
      <div className="template-list" style={{width: '350px'}}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: '20px'}}>
          <h2>Templates</h2>
          <button className="icon-btn" onClick={fetchTemplates}><RefreshCw size={18}/></button>
        </div>
        
        {loading ? (
          <div style={{textAlign:'center', padding:'20px'}}>Loading...</div>
        ) : templates.length === 0 ? (
          <div style={{textAlign:'center', padding:'20px', color:'var(--text-muted)'}}>No templates found.</div>
        ) : (
          templates.map(t => (
            <div key={t.id} className={`tpl-card ${selectedTemplate?.id === t.id ? 'active' : ''}`} onClick={() => handleSelect(t)}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
                <h4>{t.name}</h4>
                <div style={{display:'flex', gap:'5px'}}>
                  <button className="icon-btn" style={{padding:'2px'}} onClick={(e) => { e.stopPropagation(); handleEdit(t); }}><Edit3 size={14}/></button>
                  <button className="icon-btn" style={{padding:'2px', color:'#e53935'}} onClick={(e) => { e.stopPropagation(); handleDelete(t); }}><Trash2 size={14}/></button>
                </div>
              </div>
              <div style={{display:'flex', justifyContent:'space-between', marginTop: '8px', alignItems:'center'}}>
                <span className="lang-badge">{t.language}</span>
                <span style={{
                  fontSize: '0.75rem', 
                  fontWeight: 'bold', 
                  color: getStatusColor(t.status),
                  background: `${getStatusColor(t.status)}20`,
                  padding: '2px 8px',
                  borderRadius: '12px'
                }}>
                  {t.status || 'UNKNOWN'}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="trigger-pane">
        {selectedTemplate ? (
          <div className="trigger-form">
            <h2>Test Template: {selectedTemplate.name}</h2>
            
            <div className="form-group">
              <label>Target Phone Number (with country code)</label>
              <input type="tel" value={targetNumber} onChange={e => setTargetNumber(e.target.value)} placeholder="e.g. 15551234567" />
            </div>

            {requiresMedia(selectedTemplate) && (
              <div className="form-group">
                <label>Header Media Required ({selectedTemplate.components.find(c => c.type === 'HEADER').format})</label>
                <input type="file" onChange={e => setMediaFile(e.target.files[0])} />
              </div>
            )}

            {getBodyVars(selectedTemplate).length > 0 && (
              <div className="form-group">
                <label>Body Variables</label>
                {getBodyVars(selectedTemplate).map(v => (
                  <div key={v} style={{display:'flex', alignItems:'center', gap:'10px', marginBottom:'10px'}}>
                    <span>{"{{" + v + "}}"}</span>
                    <input 
                      type="text" 
                      value={variables[v] || ''} 
                      onChange={e => setVariables({...variables, [v]: e.target.value})} 
                      placeholder={`Value for {{${v}}}`}
                      style={{flex: 1}}
                    />
                  </div>
                ))}
              </div>
            )}

            <button className="primary-btn" disabled={isSending} onClick={handleSend} style={{width:'100%', justifyContent:'center'}}>
              <Send size={18} /> {isSending ? 'Sending...' : 'Send Test Message'}
            </button>
          </div>
        ) : (
          <div className="empty-state">Select a template from the list to test it</div>
        )}
      </div>
    </div>
  );
};

export default ManageTemplates;
