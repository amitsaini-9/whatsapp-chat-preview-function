import React, { useState, useRef, useEffect } from 'react';
import { UploadCloud, Plus, Trash2, Save, X } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

const TEMPLATES_API_URL = "https://asia-southeast1-learning-project-505117.cloudfunctions.net/whatsapp-templates-amit";
const GCS_UPLOAD_URL = "https://us-central1-learning-project-505117.cloudfunctions.net/gcs-upload";

const CreateTemplate = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const editMode = !!location.state?.editTemplate;
  const tpl = location.state?.editTemplate;

  const [name, setName] = useState('');
  const [category, setCategory] = useState('MARKETING');
  const [language, setLanguage] = useState('en_US');
  
  const [headerType, setHeaderType] = useState('NONE');
  const [headerText, setHeaderText] = useState('');
  const [headerExampleFile, setHeaderExampleFile] = useState(null);
  const [headerHandleUrl, setHeaderHandleUrl] = useState(null); // For Meta Resumable Upload logic in reality, but we'll use public url for now
  
  const [bodyText, setBodyText] = useState('');
  const [bodyVariables, setBodyVariables] = useState({});
  
  const [footerText, setFooterText] = useState('');
  const [buttons, setButtons] = useState([]);
  
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef(null);
  const bodyInputRef = useRef(null);

  useEffect(() => {
    if (editMode && tpl) {
      setName(tpl.name);
      setCategory(tpl.category);
      setLanguage(tpl.language);

      const header = tpl.components.find(c => c.type === 'HEADER');
      if (header) {
        setHeaderType(header.format);
        if (header.format === 'TEXT') setHeaderText(header.text || '');
      }

      const body = tpl.components.find(c => c.type === 'BODY');
      if (body) {
        setBodyText(body.text || '');
      }

      const footer = tpl.components.find(c => c.type === 'FOOTER');
      if (footer) {
        setFooterText(footer.text || '');
      }

      const btns = tpl.components.find(c => c.type === 'BUTTONS');
      if (btns && btns.buttons) {
        setButtons(btns.buttons);
      }
    }
  }, [editMode, tpl]);

  const extractVariables = (text) => {
    const regex = /\{\{(\d+)\}\}/g;
    let match;
    const vars = new Set();
    while ((match = regex.exec(text)) !== null) {
      vars.add(match[1]);
    }
    return Array.from(vars);
  };
  const currentVars = extractVariables(bodyText);

  const handleVarChange = (num, val) => {
    setBodyVariables(prev => ({...prev, [num]: val}));
  };

  const insertVariable = () => {
    // Find next available number
    let nextNum = 1;
    while (currentVars.includes(nextNum.toString())) {
      nextNum++;
    }
    const varString = `{{${nextNum}}}`;
    
    // Insert at cursor
    const el = bodyInputRef.current;
    if (el) {
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const text = bodyText;
      const newText = text.substring(0, start) + varString + text.substring(end);
      setBodyText(newText);
      // set cursor pos
      setTimeout(() => {
        el.selectionStart = el.selectionEnd = start + varString.length;
        el.focus();
      }, 0);
    } else {
      setBodyText(prev => prev + varString);
    }
  };

  const handleAddButton = (type) => {
    if (buttons.length >= 3) return;
    setButtons([...buttons, { type, text: '', url: '', phone_number: '' }]);
  };
  const handleButtonChange = (idx, field, val) => {
    const newBtns = [...buttons];
    newBtns[idx][field] = val;
    setButtons(newBtns);
  };
  const handleRemoveButton = (idx) => {
    setButtons(buttons.filter((_, i) => i !== idx));
  };
  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setHeaderExampleFile(e.target.files[0]);
    }
  };

  const handleSave = async () => {
    if (!name || !bodyText) return alert("Name and Body are required.");
    setIsSaving(true);
    try {
      const components = [];
      if (headerType === 'TEXT' && headerText) {
        components.push({ type: 'HEADER', format: 'TEXT', text: headerText });
      } else if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerType)) {
        const comp = { type: 'HEADER', format: headerType };
        
        if (headerExampleFile) {
          // Upload file to get Resumable Upload Handle
          const formData = new FormData();
          formData.append('file', headerExampleFile);
          
          const uploadRes = await fetch(TEMPLATES_API_URL, {
            method: 'POST',
            body: formData
          });
          const uploadData = await uploadRes.json();
          if (uploadData.header_handle) {
            comp.example = { header_handle: [uploadData.header_handle] };
          } else {
            alert("Warning: Failed to upload example media to Meta. Attempting to save without it.");
          }
        }
        
        components.push(comp);
      }
      
      const bodyComp = { type: 'BODY', text: bodyText };
      if (currentVars.length > 0) {
        bodyComp.example = {
          body_text: [currentVars.map(v => bodyVariables[v] || "example")]
        };
      }
      components.push(bodyComp);
      
      if (footerText) {
        components.push({ type: 'FOOTER', text: footerText });
      }
      
      if (buttons.length > 0) {
        components.push({
          type: 'BUTTONS',
          buttons: buttons.map(b => {
            if (b.type === 'QUICK_REPLY') return { type: 'QUICK_REPLY', text: b.text };
            if (b.type === 'URL') return { type: 'URL', text: b.text, url: b.url };
            if (b.type === 'PHONE_NUMBER') return { type: 'PHONE_NUMBER', text: b.text, phone_number: b.phone_number };
            return null;
          })
        });
      }

      const payload = {
        name,
        category,
        language,
        components
      };

      let url = TEMPLATES_API_URL;
      let method = 'POST';
      
      if (editMode && tpl.id) {
        method = 'PUT';
        payload.template_id = tpl.id;
      }

      const res = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      
      if (data.error) {
        alert("Error saving template: " + JSON.stringify(data.error));
      } else {
        alert("Template saved successfully!");
        navigate('/manage-templates');
      }
    } catch (e) {
      alert("Network Error");
    }
    setIsSaving(false);
  };

  return (
    <div className="template-container">
      <div className="template-card">
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: '20px'}}>
          <h2>{editMode ? 'Edit Message Template' : 'Create Message Template'}</h2>
          {editMode && <button className="icon-btn" onClick={() => navigate('/manage-templates')}><X size={24}/></button>}
        </div>
        
        <div className="form-group row">
          <div className="col">
            <label>Template Name</label>
            <input type="text" value={name} disabled={editMode} onChange={e => setName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))} placeholder="e.g. order_confirmation" />
          </div>
          <div className="col">
            <label>Category</label>
            <select value={category} onChange={e => setCategory(e.target.value)}>
              <option value="MARKETING">Marketing</option>
              <option value="UTILITY">Utility</option>
              <option value="AUTHENTICATION">Authentication</option>
            </select>
          </div>
          <div className="col">
            <label>Language</label>
            <select value={language} onChange={e => setLanguage(e.target.value)}>
              <option value="en_US">English (US)</option>
              <option value="es_ES">Spanish (ES)</option>
            </select>
          </div>
        </div>

        <div className="section">
          <h3>Header (Optional)</h3>
          <select value={headerType} onChange={e => setHeaderType(e.target.value)} style={{marginBottom: '10px'}}>
            <option value="NONE">None</option>
            <option value="TEXT">Text</option>
            <option value="IMAGE">Image</option>
            <option value="VIDEO">Video</option>
            <option value="DOCUMENT">Document</option>
          </select>
          
          {headerType === 'TEXT' && (
            <input type="text" value={headerText} onChange={e => setHeaderText(e.target.value)} placeholder="Header text..." maxLength={60} />
          )}
          
          {['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerType) && (
            <div className="file-upload-area" onClick={() => fileInputRef.current.click()}>
              <UploadCloud size={24} />
              <span>{headerExampleFile ? headerExampleFile.name : `Select example ${headerType.toLowerCase()} for approval`}</span>
              <input type="file" ref={fileInputRef} onChange={handleFileChange} style={{display: 'none'}} />
            </div>
          )}
        </div>

        <div className="section">
          <h3>Body Text</h3>
          <textarea 
            ref={bodyInputRef}
            value={bodyText} 
            onChange={e => setBodyText(e.target.value)}
            placeholder="Hello {{1}}, your order {{2}} has been shipped!"
            rows={4}
          />
          <div style={{marginTop: '10px', display: 'flex', gap: '10px', alignItems: 'center'}}>
            <span style={{fontSize: '0.85rem', color: 'var(--text-muted)'}}>Insert Variable:</span>
            <button className="chip-btn" onClick={insertVariable}><Plus size={14}/> Add {"{{"}x{"}}"}</button>
          </div>
          {currentVars.length > 0 && (
            <div className="variables-section">
              <h4>Provide Examples for Variables</h4>
              {currentVars.map(v => (
                <div key={v} className="var-input">
                  <span>{"{{" + v + "}}"} = </span>
                  <input type="text" value={bodyVariables[v] || ''} onChange={e => handleVarChange(v, e.target.value)} placeholder={`e.g. Value for {{${v}}}`} />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="section">
          <h3>Footer (Optional)</h3>
          <input type="text" value={footerText} onChange={e => setFooterText(e.target.value)} placeholder="Footer text..." maxLength={60} />
        </div>

        <div className="section">
          <h3>Buttons (Max 3)</h3>
          <div className="button-list">
            {buttons.map((btn, idx) => (
              <div key={idx} className="button-item">
                <span className="btn-type-badge">{btn.type}</span>
                <input type="text" value={btn.text} onChange={e => handleButtonChange(idx, 'text', e.target.value)} placeholder="Button Text" />
                {btn.type === 'URL' && <input type="url" value={btn.url} onChange={e => handleButtonChange(idx, 'url', e.target.value)} placeholder="https://..." />}
                {btn.type === 'PHONE_NUMBER' && <input type="tel" value={btn.phone_number} onChange={e => handleButtonChange(idx, 'phone_number', e.target.value)} placeholder="+1234567890" />}
                <button onClick={() => handleRemoveButton(idx)} className="icon-btn remove-btn-standalone"><Trash2 size={16} /></button>
              </div>
            ))}
          </div>
          {buttons.length < 3 && (
            <div className="add-btn-group">
              <button onClick={() => handleAddButton('QUICK_REPLY')}><Plus size={16}/> Quick Reply</button>
              <button onClick={() => handleAddButton('URL')}><Plus size={16}/> Call to Action (URL)</button>
              <button onClick={() => handleAddButton('PHONE_NUMBER')}><Plus size={16}/> Call Phone</button>
            </div>
          )}
        </div>

        <div className="action-row">
          <button className="primary-btn" disabled={isSaving} onClick={handleSave}>
            <Save size={18}/> {isSaving ? 'Saving...' : (editMode ? 'Update Template' : 'Submit Template')}
          </button>
        </div>
      </div>
      
      <div className="preview-pane">
        <h3>WhatsApp Preview</h3>
        <div className="wa-preview-box">
          {headerType === 'TEXT' && <div className="wa-header">{headerText}</div>}
          {['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerType) && (
            <div className="wa-media-placeholder">
              {headerExampleFile ? headerExampleFile.name : `[${headerType}]`}
            </div>
          )}
          <div className="wa-body">
            {bodyText.replace(/\{\{(\d+)\}\}/g, (match, p1) => bodyVariables[p1] ? `[${bodyVariables[p1]}]` : match)}
          </div>
          {footerText && <div className="wa-footer">{footerText}</div>}
          <div className="wa-buttons">
            {buttons.map((b, i) => (
              <div key={i} className="wa-button">{b.text || 'Button'}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateTemplate;
