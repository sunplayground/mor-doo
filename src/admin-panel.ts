import { Env } from './types';

export function getAdminHtml(_env?: Env): string {
  return `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>พี่ดาว — Admin Panel</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://unpkg.com/antd@4.24.16/dist/antd.dark.min.css">
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { margin: 0; font-family: 'Sarabun', sans-serif !important; background: #141414; }
    #root { min-height: 100vh; }
    .ant-layout { background: #141414 !important; }
    .ant-layout-header { background: #1f1f1f !important; border-bottom: 1px solid #303030; }
    .ant-card { background: #1f1f1f !important; border-color: #303030 !important; }
    .ant-table { background: transparent !important; }
    .ant-table-thead > tr > th { background: #1f1f1f !important; }
    .ant-modal-content { background: #1f1f1f !important; }
    .ant-modal-header { background: #1f1f1f !important; border-bottom-color: #303030 !important; }
    .ant-modal-footer { border-top-color: #303030 !important; }
    .ant-tabs-nav { margin-bottom: 16px !important; }
    .ant-statistic-content-value { color: #d4a574 !important; }
    .ant-input, .ant-input-affix-wrapper, .ant-select-selector,
    .ant-input-number, .ant-input-number-input {
      background: #141414 !important; border-color: #434343 !important; color: #fff !important;
    }
    textarea.ant-input { font-family: 'SF Mono', Consolas, monospace !important; font-size: 12px !important; }
    .ant-btn-primary { background: #d4a574 !important; border-color: #d4a574 !important; color: #141414 !important; font-weight: 600; }
    .ant-btn-primary:hover { background: #e0b882 !important; border-color: #e0b882 !important; }
    .ant-tabs-tab.ant-tabs-tab-active .ant-tabs-tab-btn { color: #d4a574 !important; }
    .ant-tabs-ink-bar { background: #d4a574 !important; }
    .ant-switch-checked { background-color: #d4a574 !important; }
    .ant-select-dropdown { background: #1f1f1f !important; }
    .ant-select-item { color: rgba(255,255,255,.85) !important; }
    .ant-select-item-option-active { background: #303030 !important; }
    .mono { font-family: 'SF Mono', Consolas, monospace; font-size: 11px; }
  </style>
</head>
<body>
<div id="root"></div>

<!-- load order: React → ReactDOM → antd → app -->
<script src="https://unpkg.com/react@18.3.1/umd/react.production.min.js"></script>
<script src="https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js"></script>
<script src="https://unpkg.com/antd@4.24.16/dist/antd.min.js"></script>
<script>
(function () {
'use strict';

const { useState, useEffect, useCallback } = React;
const {
  ConfigProvider, Layout, Card, Button, Table, Modal, Form,
  Input, AutoComplete, Select, InputNumber, Tabs, Space, Statistic, Row, Col,
  Typography, Tag, Spin, Badge, Switch, message: msg
} = antd;

const { Header, Content } = Layout;
const { Title, Text } = Typography;
const { TextArea } = Input;
const { TabPane } = Tabs;
const GOLD = '#d4a574';
const API = '';

// ── API helper ────────────────────────────────────────────────────
async function api(path, options, token) {
  const res = await fetch(API + path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options && options.headers),
      Authorization: 'Bearer ' + token,
    },
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

var NATAL_SYSTEM_OPTIONS = [
  { label: 'Western Tropical (all planets)', value: 'western_tropical' },
  { label: 'Thai Sidereal / Lahiri (all planets)', value: 'thai_sidereal' },
  { label: 'Current Transits (today planets)', value: 'current_transits' },
  { label: 'Bazi 四柱 (4 Pillars)', value: 'bazi' },
  { label: 'Taksa ทักษา', value: 'taksa' },
  { label: 'Vimshottari Dasha', value: 'vimshottari_dasha' },
  { label: 'Bad Year / Pi Chong ปีชง', value: 'bad_year' },
  { label: 'Western Houses', value: 'western_houses' },
  { label: 'Compatibility Inputs', value: 'compatibility_inputs' },
];

var MODEL_SUGGESTIONS = [
  'deepseek-v4-flash','deepseek-v4-pro',
  'deepseek/deepseek-chat','deepseek/deepseek-r1',
  'qwen/qwen3-235b-a22b','qwen/qwq-32b',
  'anthropic/claude-opus-4','anthropic/claude-sonnet-4-5','anthropic/claude-3-haiku',
  'openai/gpt-4o','openai/gpt-4o-mini','openai/o3-mini',
  'google/gemini-2.5-pro-preview','google/gemini-2.0-flash-001',
  'meta-llama/llama-4-maverick','meta-llama/llama-4-scout',
  'minimax-m2.5','minimax-m2.7','kimi-k2.5','kimi-k2.6',
  'mimo-v2-pro','mimo-v2.5-pro',
].map(function(v) { return { value: v }; });

// ── Login ─────────────────────────────────────────────────────────
function LoginPage(props) {
  const [pw, setPw] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  async function doLogin() {
    if (!pw) return;
    setLoading(true); setErr('');
    try {
      const res = await fetch(API + '/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pw }),
      });
      const data = await res.json();
      if (data.success) {
        localStorage.setItem('admin_token', data.token);
        props.onLogin(data.token);
      } else {
        setErr('รหัสผ่านไม่ถูกต้อง');
      }
    } catch (e) { setErr('Connection error'); }
    setLoading(false);
  }

  return React.createElement('div', {
    style: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#141414' }
  },
    React.createElement(Card, { style: { width: 360, background: '#1f1f1f', borderColor: '#303030' } },
      React.createElement(Title, { level: 3, style: { textAlign: 'center', color: GOLD, marginBottom: 24 } }, '🔮 Admin Panel'),
      React.createElement(Input.Password, {
        placeholder: 'Password', size: 'large',
        value: pw, onChange: function(e) { setPw(e.target.value); },
        onPressEnter: doLogin,
        style: { marginBottom: 12 }
      }),
      err ? React.createElement(Text, { type: 'danger', style: { display: 'block', marginBottom: 8, textAlign: 'center' } }, err) : null,
      React.createElement(Button, {
        type: 'primary', size: 'large', block: true, loading: loading,
        onClick: doLogin
      }, 'Login')
    )
  );
}

// ── Stats ─────────────────────────────────────────────────────────
function StatsRow(props) {
  const [stats, setStats] = useState({});
  useEffect(function() {
    api('/api/admin/stats', {}, props.token).then(setStats).catch(function() {});
  }, [props.token]);
  var items = [
    { title: 'Total Users', value: stats.totalUsers },
    { title: 'Total Messages', value: stats.totalMessages },
    { title: 'Total Events', value: stats.totalEvents },
    { title: 'Active Today', value: stats.activeToday },
  ];
  return React.createElement(Row, { gutter: [16, 16], style: { marginBottom: 24 } },
    items.map(function(s) {
      return React.createElement(Col, { key: s.title, xs: 12, sm: 6 },
        React.createElement(Card, { size: 'small', style: { textAlign: 'center' } },
          React.createElement(Statistic, { title: s.title, value: s.value !== undefined ? s.value : '-' })
        )
      );
    })
  );
}

// ── Feature Edit Modal ────────────────────────────────────────────
function FeatureEditModal(props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();
  const [tab, setTab] = useState('config');

  useEffect(function() {
    if (!props.feature) return;
    setLoading(true); setTab('config');
    api('/api/admin/features/' + props.feature, {}, props.token).then(function(d) {
      form.setFieldsValue({
        ai_model:             d.ai_model || 'deepseek-v4-flash',
        max_tokens:           d.max_tokens || 8000,
        enabled:              d.enabled !== 0,
        natal_source_systems: d.natalSourceSystems || [],
        skill_md:             d.skillMd || '',
        reference_md:         d.referenceMd || '',
      });
      setLoading(false);
    }).catch(function() { setLoading(false); });
  }, [props.feature]);

  async function save() {
    var vals;
    try { vals = await form.validateFields(); } catch (e) { return; }
    setSaving(true);
    try {
      await api('/api/admin/features/' + props.feature, {
        method: 'PUT',
        body: JSON.stringify({
          ai_model:             vals.ai_model,
          enabled:              vals.enabled ? 1 : 0,
          max_tokens:           vals.max_tokens,
          natal_source_systems: vals.natal_source_systems || [],
          skill_md:             vals.skill_md,
          reference_md:         vals.reference_md,
        }),
      }, props.token);
      props.onSaved();
      props.onClose();
    } catch (e) { msg.error('Save failed'); }
    setSaving(false);
  }

  function configTab() {
    return React.createElement(React.Fragment, null,
      React.createElement(Row, { gutter: 16 },
        React.createElement(Col, { xs: 24, sm: 10 },
          React.createElement(Form.Item, { name: 'ai_model', label: 'AI Model' },
            React.createElement(AutoComplete, {
              options: MODEL_SUGGESTIONS,
              style: { width: '100%' },
              placeholder: 'Enter or select model',
              filterOption: function(input, option) { return (option.value || '').toLowerCase().includes(input.toLowerCase()); },
            })
          )
        ),
        React.createElement(Col, { xs: 12, sm: 7 },
          React.createElement(Form.Item, { name: 'max_tokens', label: 'Max Tokens' },
            React.createElement(InputNumber, {
              min: 256, max: 32000, step: 256, style: { width: '100%' },
              formatter: function(v) { return v ? v.toString().replace(/\\B(?=(\\d{3})+(?!\\d))/g, ',') : ''; },
              parser: function(v) { return parseInt((v || '').replace(/,/g, '') || '8000', 10); },
            })
          )
        ),
        React.createElement(Col, { xs: 12, sm: 7 },
          React.createElement(Form.Item, { name: 'enabled', label: 'Status', valuePropName: 'checked' },
            React.createElement(Switch, { checkedChildren: 'Enabled', unCheckedChildren: 'Disabled' })
          )
        )
      ),
      React.createElement(Form.Item, {
        name: 'natal_source_systems',
        label: 'Natal Chart Systems',
        extra: 'Selected systems will be calculated and injected into the AI system prompt for this feature.',
      },
        React.createElement(Select, {
          mode: 'multiple',
          placeholder: 'Select systems to inject (none = skip natal data)',
          style: { width: '100%' },
          options: NATAL_SYSTEM_OPTIONS,
          allowClear: true,
        })
      )
    );
  }

  var modalContent = loading
    ? React.createElement(Spin, { style: { display: 'block', margin: '40px auto' } })
    : React.createElement(Form, { form: form, layout: 'vertical' },
        React.createElement(Tabs, { activeKey: tab, onChange: setTab, size: 'small' },
          React.createElement(TabPane, { tab: 'Configuration', key: 'config' }, configTab()),
          React.createElement(TabPane, { tab: 'skill.md', key: 'skill_md' },
            React.createElement(Form.Item, { name: 'skill_md', style: { marginBottom: 0 } },
              React.createElement(TextArea, { autoSize: { minRows: 14, maxRows: 20 } })
            )
          ),
          React.createElement(TabPane, { tab: 'reference.md', key: 'reference_md' },
            React.createElement(Form.Item, { name: 'reference_md', style: { marginBottom: 0 } },
              React.createElement(TextArea, { autoSize: { minRows: 14, maxRows: 20 } })
            )
          )
        )
      );

  return React.createElement(Modal, {
    visible: !!props.feature,
    title: React.createElement(Space, null,
      React.createElement(Text, { style: { color: GOLD } }, '✏️ Edit Feature'),
      React.createElement(Tag, { color: 'gold' }, props.feature)
    ),
    width: 760,
    onCancel: props.onClose,
    destroyOnClose: true,
    footer: React.createElement(Space, null,
      React.createElement(Button, { onClick: props.onClose }, 'Cancel'),
      React.createElement(Button, { type: 'primary', loading: saving, onClick: save }, 'Save Changes')
    ),
  }, modalContent);
}

// ── Features Tab ──────────────────────────────────────────────────
function FeaturesTab(props) {
  const [features, setFeatures] = useState([]);
  const [editFeature, setEditFeature] = useState(null);

  var load = useCallback(function() {
    api('/api/admin/features', {}, props.token).then(setFeatures).catch(function() {});
  }, [props.token]);

  useEffect(function() { load(); }, [load]);

  var columns = [
    {
      title: 'Feature', dataIndex: 'feature',
      render: function(v) { return React.createElement(Text, { strong: true }, v); }
    },
    {
      title: 'Model', dataIndex: 'ai_model',
      render: function(v) { return React.createElement(Tag, null, v); }
    },
    {
      title: 'Max Tokens', dataIndex: 'max_tokens',
      render: function(v) { return React.createElement('span', { className: 'mono' }, v ? Number(v).toLocaleString() : '8,000'); }
    },
    {
      title: 'Status', dataIndex: 'enabled',
      render: function(v) { return React.createElement(Badge, { status: v ? 'success' : 'error', text: v ? 'Enabled' : 'Disabled' }); }
    },
    {
      title: 'Action', key: 'action',
      render: function(_, row) {
        return React.createElement(Button, { size: 'small', onClick: function() { setEditFeature(row.feature); } }, 'Edit');
      }
    },
  ];

  return React.createElement(React.Fragment, null,
    React.createElement(Table, {
      dataSource: features, columns: columns,
      rowKey: 'feature', size: 'small', pagination: false,
    }),
    React.createElement(FeatureEditModal, {
      feature: editFeature,
      token: props.token,
      onClose: function() { setEditFeature(null); },
      onSaved: function() { load(); msg.success('Saved!'); },
    })
  );
}

// ── Memory Modal ──────────────────────────────────────────────────
function MemoryModal(props) {
  const [memory, setMemory] = useState('');
  const [loading, setLoading] = useState(false);
  const [regen, setRegen] = useState(false);

  useEffect(function() {
    if (!props.user) return;
    setLoading(true);
    api('/api/admin/users/' + encodeURIComponent(props.user.line_user_id) + '/memory', {}, props.token)
      .then(function(d) { setMemory(d.memory || '(empty)'); setLoading(false); })
      .catch(function() { setLoading(false); });
  }, [props.user]);

  async function regenerate() {
    if (!window.confirm('Overwrite memory by regenerating from ALL logs. Continue?')) return;
    setRegen(true);
    try {
      var d = await api('/api/admin/users/' + encodeURIComponent(props.user.line_user_id) + '/regenerate-memory', { method: 'POST' }, props.token);
      setMemory(d.memory || '(empty)');
      msg.success('Memory regenerated!');
    } catch (e) { msg.error('Failed'); }
    setRegen(false);
  }

  return React.createElement(Modal, {
    visible: !!props.user,
    title: React.createElement(Text, { style: { color: GOLD } }, '🧠 Memory: ' + (props.user ? props.user.name || 'User' : '')),
    width: 640,
    onCancel: props.onClose,
    destroyOnClose: true,
    footer: React.createElement(Space, null,
      React.createElement(Button, { loading: regen, onClick: regenerate }, 'Regenerate from Logs'),
      React.createElement(Button, { type: 'primary', onClick: props.onClose }, 'Close')
    ),
  },
    loading
      ? React.createElement(Spin, { style: { display: 'block', margin: '24px auto' } })
      : React.createElement('pre', {
          style: {
            background: '#141414', padding: 12, borderRadius: 6,
            fontSize: 12, maxHeight: 380, overflowY: 'auto',
            whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: '#aaa', margin: 0,
          }
        }, memory)
  );
}

// ── Users Tab ─────────────────────────────────────────────────────
function UsersTab(props) {
  const [users, setUsers] = useState([]);
  const [memUser, setMemUser] = useState(null);
  useEffect(function() {
    api('/api/admin/users', {}, props.token).then(setUsers).catch(function() {});
  }, [props.token]);
  var columns = [
    { title: 'Name', dataIndex: 'name', render: function(v) { return v || '-'; } },
    { title: 'LINE ID', dataIndex: 'line_user_id', render: function(v) { return React.createElement('span', { className: 'mono' }, v.substring(0, 18) + '…'); } },
    { title: 'Birth Date', dataIndex: 'birth_date', render: function(v) { return v || '-'; } },
    { title: 'Tier', dataIndex: 'tier', render: function(v) { return React.createElement(Tag, { color: v === 'paid' ? 'gold' : 'default' }, v); } },
    { title: 'Joined', dataIndex: 'created_at', render: function(v) { return (v || '').substring(0, 10); } },
    { title: 'Action', key: 'action', render: function(_, row) { return React.createElement(Button, { size: 'small', onClick: function() { setMemUser(row); } }, 'Memory'); } },
  ];
  return React.createElement(React.Fragment, null,
    React.createElement(Table, { dataSource: users, columns: columns, rowKey: 'line_user_id', size: 'small', scroll: { x: true } }),
    React.createElement(MemoryModal, { user: memUser, token: props.token, onClose: function() { setMemUser(null); } })
  );
}

// ── Logs Tab ──────────────────────────────────────────────────────
function LogsTab(props) {
  const [logs, setLogs] = useState([]);
  useEffect(function() {
    api('/api/admin/logs', {}, props.token).then(setLogs).catch(function() {});
  }, [props.token]);
  var columns = [
    { title: 'Time', dataIndex: 'created_at', render: function(v) { return React.createElement('span', { className: 'mono' }, (v || '').substring(0, 19)); } },
    { title: 'User', dataIndex: 'line_user_id', render: function(v) { return React.createElement('span', { className: 'mono' }, (v || '').substring(0, 14) + '…'); } },
    { title: 'Dir', dataIndex: 'direction', render: function(v) { return React.createElement(Tag, { color: v === 'inbound' ? 'blue' : 'green' }, v); } },
    { title: 'Feature', dataIndex: 'feature', render: function(v) { return v || '-'; } },
    { title: 'Content', dataIndex: 'content', render: function(v) { return (v || '').substring(0, 80) + ((v || '').length > 80 ? '…' : ''); } },
  ];
  return React.createElement(Table, { dataSource: logs, columns: columns, rowKey: 'id', size: 'small', scroll: { x: true } });
}

// ── Push Notifications Tab ────────────────────────────────────────
function PushTab(props) {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [pushType, setPushType] = useState('morning');
  const [sending, setSending] = useState(false);
  const [preview, setPreview] = useState('');
  const [editFeature, setEditFeature] = useState(null);

  useEffect(function() {
    api('/api/admin/users', {}, props.token).then(setUsers).catch(function() {});
  }, [props.token]);

  async function sendTestPush() {
    if (!selectedUser) { msg.warning('กรุณาเลือก User ก่อน'); return; }
    setSending(true); setPreview('');
    try {
      var d = await api('/api/admin/test-push', {
        method: 'POST',
        body: JSON.stringify({ lineUserId: selectedUser, pushType: pushType }),
      }, props.token);
      msg.success('Push sent!');
      if (d.preview) setPreview(d.preview);
    } catch (e) { msg.error('Failed: ' + (e.message || 'unknown')); }
    setSending(false);
  }

  var userOptions = users
    .filter(function(u) { return u.birth_date && u.onboarding_complete; })
    .map(function(u) { return { label: (u.name || 'User') + ' — ' + u.line_user_id.substring(0, 14), value: u.line_user_id }; });

  return React.createElement(React.Fragment, null,
    React.createElement(Card, {
      title: '🌅 Morning Push Skill',
      style: { marginBottom: 16 },
      extra: React.createElement(Button, { size: 'small', onClick: function() { setEditFeature('morning-push'); } }, 'Edit Skill'),
    },
      React.createElement(Text, { type: 'secondary' },
        'Controls the prompt used for the 7AM daily push notification. ' +
        'If skill.md is empty the system falls back to the daily-reading skill. ' +
        'Tip: keep it short and personal — push notifications work best in 3-4 lines.'
      )
    ),
    React.createElement(Card, { title: '🧪 Send Test Push' },
      React.createElement(Space, { direction: 'vertical', style: { width: '100%' } },
        React.createElement(Space, { wrap: true },
          React.createElement(Select, {
            placeholder: 'Select user',
            style: { width: 300 },
            options: userOptions,
            showSearch: true,
            filterOption: function(input, option) { return (option.label || '').toLowerCase().includes(input.toLowerCase()); },
            onChange: setSelectedUser,
            value: selectedUser,
          }),
          React.createElement(Select, {
            value: pushType, onChange: setPushType,
            style: { width: 180 },
            options: [
              { label: '☀️ Morning (Daily)', value: 'morning' },
              { label: '🌙 Weekly', value: 'weekly' },
            ],
          }),
          React.createElement(Button, {
            type: 'primary', loading: sending, disabled: !selectedUser,
            onClick: sendTestPush,
          }, 'Send Push')
        ),
        preview ? React.createElement('div', {
          style: {
            background: '#141414', padding: '12px 16px', borderRadius: 6,
            fontSize: 13, color: '#aaa', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            border: '1px solid #303030', marginTop: 8,
          }
        },
          React.createElement(Text, { type: 'secondary', style: { fontSize: 11, display: 'block', marginBottom: 4 } }, 'Preview (first 200 chars):'),
          preview
        ) : null
      )
    ),
    React.createElement(FeatureEditModal, {
      feature: editFeature,
      token: props.token,
      onClose: function() { setEditFeature(null); },
      onSaved: function() { msg.success('morning-push skill saved!'); },
    })
  );
}

// ── App ───────────────────────────────────────────────────────────
function AdminApp() {
  const [token, setToken] = useState(localStorage.getItem('admin_token') || '');

  function logout() { setToken(''); localStorage.removeItem('admin_token'); }

  if (!token) return React.createElement(LoginPage, { onLogin: setToken });

  var tabPanes = [
    { key: 'features', tab: '⚙️ Features & Skills', content: React.createElement(FeaturesTab, { token: token }) },
    { key: 'push',     tab: '📣 Push Notifications', content: React.createElement(PushTab, { token: token }) },
    { key: 'users',    tab: '👥 Users',              content: React.createElement(UsersTab, { token: token }) },
    { key: 'logs',     tab: '📜 Logs',               content: React.createElement(LogsTab, { token: token }) },
  ];

  return React.createElement(Layout, null,
    React.createElement(Header, { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', position: 'sticky', top: 0, zIndex: 10 } },
      React.createElement(Space, null,
        React.createElement(Title, { level: 4, style: { color: GOLD, margin: 0 } }, '🔮 พี่ดาว Admin'),
        React.createElement(Text, { style: { color: '#666', fontSize: 13 } }, 'Management Panel')
      ),
      React.createElement(Button, { size: 'small', onClick: logout }, 'Logout')
    ),
    React.createElement(Content, { style: { padding: '24px', maxWidth: 1100, margin: '0 auto', width: '100%' } },
      React.createElement(StatsRow, { token: token }),
      React.createElement(Tabs, { defaultActiveKey: 'features', size: 'middle' },
        tabPanes.map(function(p) {
          return React.createElement(TabPane, { tab: p.tab, key: p.key }, p.content);
        })
      )
    )
  );
}

// ── Bootstrap ─────────────────────────────────────────────────────
var root = ReactDOM.createRoot(document.getElementById('root'));
root.render(React.createElement(ConfigProvider, { autoInsertSpaceInButton: false }, React.createElement(AdminApp)));

})();
</script>
</body>
</html>`;
}
