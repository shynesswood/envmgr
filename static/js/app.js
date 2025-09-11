// 载入日志，确认脚本是否被浏览器执行
console.log('[envmgr] app.js loaded');

// 全局标记，防止重复初始化
if (window.envManagerInitialized) {
    console.log('[envmgr] already initialized, skipping');
} else {
    window.envManagerInitialized = true;
}

class EnvironmentManager {
    constructor() {
        this.envVars = []; // 现在是对象数组而不是map
        this.currentTab = 'user'; // 当前选中的tab：'user' 或 'system'
        this.isAdmin = false; // 是否管理员
        this._adding = false;
        this._editing = false;
        this._deleting = false;
        this.groups = [];
        this._creatingGroup = false;
        this._savingGroup = false;
        this._deletingGroup = false;
        this._switchingGroup = false;
        this.init();
    }

    async init() {
        console.log('[envmgr] EnvironmentManager.init() called');
        // 先检查管理员状态
        await this.fetchAdminStatus();
        // 注册事件监听
        this.setupEventListeners();
        // 默认进入环境变量视图
        console.log('[envmgr] init -> loading env vars');
        await this.loadEnvVars();
    }

    async fetchAdminStatus() {
        try {
            const res = await fetch('/api/admin');
            if (!res.ok) throw new Error('failed to fetch admin status');
            const data = await res.json();
            this.isAdmin = !!data.isAdmin;
            console.log('[envmgr] isAdmin =', this.isAdmin);
        } catch (e) {
            console.warn('[envmgr] 获取管理员状态失败，默认非管理员');
            this.isAdmin = false;
        }
    }

    // 全局加载
    showGlobalLoading(message = '正在加载...') {
        const overlay = document.getElementById('globalLoading');
        if (!overlay) return;
        const textSpan = overlay.querySelector('span');
        if (textSpan) textSpan.textContent = message;
        overlay.classList.remove('hidden');
        overlay.classList.add('flex');
    }

    hideGlobalLoading() {
        const overlay = document.getElementById('globalLoading');
        if (!overlay) return;
        overlay.classList.add('hidden');
        overlay.classList.remove('flex');
    }

    // 按钮加载态/防抖
    setButtonLoading(button, isLoading, loadingText = '处理中...') {
        if (!button) return;
        if (isLoading) {
            if (!button.dataset.originalText) {
                button.dataset.originalText = button.innerHTML;
            }
            button.disabled = true;
            button.classList.add('opacity-70', 'cursor-not-allowed');
            button.innerHTML = `
                <span class="inline-flex items-center">
                    <svg class="w-4 h-4 mr-2 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                    </svg>
                    ${loadingText}
                </span>
            `;
        } else {
            button.disabled = false;
            button.classList.remove('opacity-70', 'cursor-not-allowed');
            if (button.dataset.originalText) {
                button.innerHTML = button.dataset.originalText;
                delete button.dataset.originalText;
            }
        }
    }

    // 成功提示
    showToast(message, type = 'success') {
        const container = document.getElementById('toastContainer');
        if (!container) return;
        const toast = document.createElement('div');
        const color = type === 'success' ? 'bg-green-600' : (type === 'error' ? 'bg-red-600' : 'bg-gray-700');
        toast.className = `${color} text-white text-sm rounded shadow px-3 py-2 flex items-center`;
        toast.innerHTML = `
            <svg class="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
            </svg>
            <span>${message}</span>
        `;
        container.appendChild(toast);
        setTimeout(() => {
            toast.classList.add('opacity-0', 'transition-opacity', 'duration-300');
            setTimeout(() => container.removeChild(toast), 300);
        }, 1800);
    }

    async loadEnvVars() {
        try {
            this.showGlobalLoading('正在加载环境变量...');
            console.log('[envmgr] fetch /api/env ...');
            const response = await fetch('/api/env');
            if (!response.ok) throw new Error('Failed to load environment variables');
            this.envVars = await response.json();

            // 先更新计数
            this.updateVariableCounts();
            console.log('[envmgr] fetch /api/env done, count =', this.envVars.length);

            // 根据数据情况自动切换到有数据的标签
            const hasUser = this.envVars.some(envVar => envVar.source === 'user');
            const hasSystem = this.envVars.some(envVar => envVar.source === 'system');
            let preferredTab = this.currentTab;
            if (preferredTab === 'user' && !hasUser && hasSystem) {
                preferredTab = 'system';
            }
            if (preferredTab === 'system' && !hasSystem && hasUser) {
                preferredTab = 'user';
            }
            if (preferredTab !== this.currentTab) {
                this.currentTab = preferredTab;
                // 同步tab样式
                document.querySelectorAll('.tab-button').forEach(button => {
                    button.classList.remove('active');
                    if (button.dataset.tab === preferredTab) {
                        button.classList.add('active');
                    }
                });
            }

            this.renderTable();
        } catch (error) {
            console.error('加载环境变量时出错:', error);
            alert('加载环境变量时出错');
        } finally {
            this.hideGlobalLoading();
        }
    }

    renderTable() {
        const tbody = document.getElementById('envTableBody');
        tbody.innerHTML = '';

        // 过滤当前tab的变量
        const filteredVars = this.envVars.filter(envVar => envVar.source === this.currentTab);
        
        // Sort by name
        const sortedVars = filteredVars.sort((a, b) => a.name.localeCompare(b.name));

        sortedVars.forEach((envVar, index) => {
            const row = document.createElement('tr');
            row.dataset.index = index;
            row.dataset.key = envVar.name;
            row.dataset.source = envVar.source;
            
            // 根据来源设置不同的样式
            if (envVar.source === 'system') {
                row.className = 'hover:bg-gray-50 cursor-pointer transition-colors duration-150 bg-gray-25';
            } else {
                row.className = 'hover:bg-gray-50 cursor-pointer transition-colors duration-150';
            }
            
            const nameCell = document.createElement('td');
            nameCell.className = 'px-6 py-4 whitespace-nowrap text-sm font-medium';
            
            // 变量名称 - 可点击查看详情
            const nameLink = document.createElement('button');
            nameLink.textContent = envVar.name;
            nameLink.className = 'text-left hover:text-blue-600 transition-colors duration-200 cursor-pointer';
            if (envVar.source === 'system') {
                nameLink.className += ' text-gray-700';
            } else {
                nameLink.className += ' text-gray-900';
            }
            nameLink.onclick = (e) => {
                e.stopPropagation();
                this.showValueDetails(envVar.name, envVar.value, envVar.source);
            };
            nameLink.title = '点击查看详情';
            nameCell.appendChild(nameLink);
            
            const valueCell = document.createElement('td');
            valueCell.className = 'px-6 py-4 whitespace-nowrap text-sm font-mono text-xs truncate';
            if (envVar.source === 'system') {
                valueCell.className += ' text-gray-500';
            } else {
                valueCell.className += ' text-gray-700';
            }
            
            // Truncate long values
            const maxLength = 50;
            const displayValue = envVar.value.length > maxLength ? envVar.value.substring(0, maxLength) + '...' : envVar.value;
            valueCell.textContent = displayValue;
            valueCell.title = envVar.value; // Show full value on hover
            
            // 操作列
            const actionCell = document.createElement('td');
            actionCell.className = 'px-6 py-4 whitespace-nowrap text-sm font-medium';
            
            // 系统变量和用户变量都支持编辑和删除
            const editBtn = document.createElement('button');
            editBtn.className = 'text-indigo-600 hover:text-indigo-900 mr-3 transition-colors duration-200';
            editBtn.innerHTML = `
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                </svg>
            `;
            editBtn.title = envVar.source === 'system' ? '编辑系统变量' : '编辑变量';
            editBtn.onclick = (e) => {
                e.stopPropagation();
                this.showInlineEditDialog(envVar.name, envVar.value);
            };
            
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'text-red-600 hover:text-red-900 transition-colors duration-200';
            deleteBtn.innerHTML = `
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                </svg>
            `;
            deleteBtn.title = envVar.source === 'system' ? '删除系统变量' : '删除变量';
            deleteBtn.onclick = (e) => {
                e.stopPropagation();
                this.showInlineDeleteDialog(envVar.name);
            };
            
            // 非管理员时，不允许对系统变量进行编辑/删除
            if (envVar.source === 'system' && !this.isAdmin) {
                // 显示禁用态提示：不附加按钮，避免误触
            } else {
                actionCell.appendChild(editBtn);
                actionCell.appendChild(deleteBtn);
            }
            
            row.appendChild(nameCell);
            row.appendChild(valueCell);
            row.appendChild(actionCell);
            
            tbody.appendChild(row);
        });

        // Header显示总数（而非当前筛选数量）
        document.getElementById('varCount').textContent = this.envVars.length;
    }


    switchTab(tab) {
        this.currentTab = tab;
        
        // 更新tab样式
        document.querySelectorAll('.tab-button').forEach(button => {
            button.classList.remove('active');
            if (button.dataset.tab === tab) {
                button.classList.add('active');
            }
        });
        
        // 显示/隐藏系统变量警告
        const systemWarning = document.getElementById('systemWarning');
        if (tab === 'system') {
            systemWarning.classList.remove('hidden');
        } else {
            systemWarning.classList.add('hidden');
        }
        
        this.renderTable();
    }

    updateVariableCounts() {
        const userVars = this.envVars.filter(envVar => envVar.source === 'user');
        const systemVars = this.envVars.filter(envVar => envVar.source === 'system');
        
        document.getElementById('userVarCount').textContent = userVars.length;
        document.getElementById('systemVarCount').textContent = systemVars.length;
    }

    setupEventListeners() {
        console.log('[envmgr] setupEventListeners() called');
        document.getElementById('addBtn').addEventListener('click', () => this.showAddDialog());
        const menuEnv = document.getElementById('menuEnv');
        const menuGroup = document.getElementById('menuGroup');
        if (menuEnv && menuGroup) {
            menuEnv.addEventListener('click', () => this.showEnvView());
            menuGroup.addEventListener('click', () => this.showGroupView());
        }
        const addGroupBtn = document.getElementById('addGroupBtn');
        if (addGroupBtn) {
            addGroupBtn.addEventListener('click', () => this.showAddGroupDialog());
        }
        
        // Modal close button
        document.querySelector('.close').addEventListener('click', () => this.closeModal());
        
        // Click outside modal to close
        window.addEventListener('click', (event) => {
            const modal = document.getElementById('modal');
            if (event.target === modal) {
                this.closeModal();
            }
        });

        // Tab switching
        document.getElementById('userTab').addEventListener('click', () => this.switchTab('user'));
        document.getElementById('systemTab').addEventListener('click', () => this.switchTab('system'));
    }

    // 视图切换
    showEnvView() {
        document.getElementById('envControls').classList.remove('hidden');
        document.getElementById('envContainer').classList.remove('hidden');
        document.getElementById('envTabs').classList.remove('hidden');
        document.getElementById('groupSection').classList.add('hidden');
        // 菜单选中样式
        const menuEnv = document.getElementById('menuEnv');
        const menuGroup = document.getElementById('menuGroup');
        menuEnv.classList.add('active');
        menuGroup.classList.remove('active');
        this.loadEnvVars();
    }

    async showGroupView() {
        document.getElementById('envControls').classList.add('hidden');
        document.getElementById('envContainer').classList.add('hidden');
        document.getElementById('envTabs').classList.add('hidden');
        document.getElementById('groupSection').classList.remove('hidden');
        // 菜单选中样式
        const menuEnv = document.getElementById('menuEnv');
        const menuGroup = document.getElementById('menuGroup');
        menuGroup.classList.add('active');
        menuEnv.classList.remove('active');
        await this.loadGroups();
        this.renderGroups();
    }

    async loadGroups() {
        try {
            this.showGlobalLoading('正在加载分组...');
            const res = await fetch('/api/envgroup');
            if (!res.ok) throw new Error('Failed to load groups');
            this.groups = await res.json();
        } catch (e) {
            console.error('加载分组失败', e);
            alert('加载分组失败');
        } finally {
            this.hideGlobalLoading();
        }
    }

    renderGroups() {
        const tbody = document.getElementById('groupTableBody');
        if (!tbody) return;
        tbody.innerHTML = '';
        const sorted = [...this.groups].sort((a, b) => a.name.localeCompare(b.name));
        sorted.forEach(g => {
            const tr = document.createElement('tr');
            const nameTd = document.createElement('td');
            nameTd.className = 'px-6 py-4 whitespace-nowrap text-sm font-medium';
            const nameBtn = document.createElement('button');
            nameBtn.className = 'text-left text-blue-600 hover:text-blue-800 underline';
            nameBtn.textContent = g.name;
            nameBtn.onclick = () => this.showGroupDetails(g);
            nameTd.appendChild(nameBtn);
            const remarkTd = document.createElement('td');
            remarkTd.className = 'px-6 py-4 whitespace-nowrap text-sm text-gray-700';
            const esc = (s) => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
            const selectedItems = (g.itemList || []).filter(it => it.selected);
            const selectedHtml = selectedItems.length
                ? `<div class="mt-1 flex flex-wrap gap-1">${selectedItems.map(it => `<span class=\"inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800\">${esc(it.name || '(未命名条目)')}</span>`).join(' ')}</div>`
                : `<div class="mt-1 text-xs text-gray-400">无默认选中条目</div>`;
            remarkTd.innerHTML = `${esc(g.remark || '')}${selectedHtml}`;
            const actionTd = document.createElement('td');
            actionTd.className = 'px-6 py-4 whitespace-nowrap text-sm';
            const switchBtn = document.createElement('button');
            switchBtn.className = 'text-blue-600 hover:text-blue-900 mr-3';
            switchBtn.textContent = '切换';
            switchBtn.onclick = () => this.showSwitchGroupDialog(g);

            const editBtn = document.createElement('button');
            editBtn.className = 'text-indigo-600 hover:text-indigo-900 mr-3';
            editBtn.textContent = '编辑';
            editBtn.onclick = () => this.showEditGroupDialog(g);
            const delBtn = document.createElement('button');
            delBtn.className = 'text-red-600 hover:text-red-900';
            delBtn.textContent = '删除';
            delBtn.onclick = () => this.showDeleteGroupDialog(g.name);
            actionTd.appendChild(switchBtn);
            actionTd.appendChild(editBtn);
            actionTd.appendChild(delBtn);
            tr.appendChild(nameTd);
            tr.appendChild(remarkTd);
            tr.appendChild(actionTd);
            tbody.appendChild(tr);
        });
    }

    showGroupDetails(group) {
        const itemsHtml = (group.itemList || []).map(item => {
            const envs = (item.envList || []).map(env => {
                return `
                    <tr>
                        <td class="px-3 py-1 text-xs font-mono">${env.name}</td>
                        <td class="px-3 py-1 text-xs font-mono truncate" title="${env.value}">${env.value}</td>
                        <td class="px-3 py-1 text-xs">${env.source === 'system' ? '系统' : '用户'}</td>
                        <td class="px-3 py-1 text-xs">${env.remark || ''}</td>
                    </tr>
                `;
            }).join('');
            return `
                <div class="border border-gray-200 rounded-md p-3 mb-3">
                    <div class="flex items-center justify-between mb-2">
                        <div class="text-sm font-medium text-gray-800">${item.name || '(未命名条目)'}</div>
                        <div class="flex items-center gap-2">
                            ${item.selected 
                                ? `<span class=\"inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800\">默认选中</span>`
                                : `<span class=\"inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600\">未选中</span>`}
                            ${item.remark ? `<div class=\"text-xs text-gray-500\">${item.remark}</div>` : ''}
                        </div>
                    </div>
                    <div class="overflow-x-auto">
                        <table class="min-w-full divide-y divide-gray-200">
                            <thead class="bg-gray-50">
                                <tr>
                                    <th class="px-3 py-1 text-left text-xs text-gray-500">变量名</th>
                                    <th class="px-3 py-1 text-left text-xs text-gray-500">变量值</th>
                                    <th class="px-3 py-1 text-left text-xs text-gray-500">来源</th>
                                    <th class="px-3 py-1 text-left text-xs text-gray-500">备注</th>
                                </tr>
                            </thead>
                            <tbody>${envs || ''}</tbody>
                        </table>
                    </div>
                </div>
            `;
        }).join('');

        const selectedItems = (group.itemList || []).filter(it => it.selected);
        const selectedSummaryHtml = selectedItems.length
            ? selectedItems.map(it => `<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">${it.name || '(未命名条目)'}</span>`).join(' ')
            : '<span class="text-xs text-gray-500">无默认选中条目</span>';

        const content = `
            <div class="space-y-4">
                <div>
                    <div class="text-sm text-gray-500">分组名称</div>
                    <div class="text-base font-medium text-gray-800">${group.name}</div>
                </div>
                <div>
                    <div class="text-sm text-gray-500">默认选中条目</div>
                    <div class="flex flex-wrap gap-2 mt-1">${selectedSummaryHtml}</div>
                </div>
                ${group.remark ? `
                <div>
                    <div class="text-sm text-gray-500">备注</div>
                    <div class="text-sm text-gray-800 whitespace-pre-wrap">${group.remark}</div>
                </div>` : ''}
                <div>
                    <div class="text-sm text-gray-700 mb-2">条目列表</div>
                    ${itemsHtml || '<div class="text-xs text-gray-500">无条目</div>'}
                </div>
                <div class="flex justify-end">
                    <button onclick="envManager.closeModal()" class="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors duration-200">关闭</button>
                </div>
            </div>
        `;
        this.showModal(content, '分组详情');
    }

    showSwitchGroupDialog(group) {
        // 计算默认选中项：若存在多个 selected=true，取第一个；否则取第一个条目
        const itemList = group.itemList || [];
        const selectedItem = itemList.find(it => it.selected);
        const defaultName = (selectedItem ? selectedItem.name : (itemList[0] ? itemList[0].name : '')) || '';
        // 构建条目下拉，标记默认选中
        const options = itemList.map(it => `<option value="${it.name}" ${it.name === defaultName ? 'selected' : ''}>${it.name || '(未命名条目)'}</option>`).join('');
        const content = `
            <div class="space-y-4">
                <div>
                    <div class="text-sm text-gray-500">分组名称</div>
                    <div class="text-base font-medium text-gray-800">${group.name}</div>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">选择条目</label>
                    <select id="switchItemName" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500">${options}</select>
                    <p class="text-xs text-gray-500 mt-1">将把所选条目的环境变量批量写入系统/用户环境。</p>
                </div>
                <div class="flex justify-end space-x-3 pt-4">
                    <button onclick="envManager.closeModal()" class="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors duration-200">取消</button>
                    <button id="btnSwitchConfirm" class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors duration-200">切换</button>
                </div>
            </div>
        `;
        this._switchTargetGroup = group.name;
        this.showModal(content, '切换环境');
        // 绑定确认事件，避免依赖其它弹窗的委托监听
        const btn = document.getElementById('btnSwitchConfirm');
        if (btn) {
            btn.addEventListener('click', () => this.submitSwitchGroup(), { once: true });
        }
    }

    async submitSwitchGroup() {
        if (this._switchingGroup) return;
        this._switchingGroup = true;
        const btn = document.getElementById('btnSwitchConfirm');
        this.setButtonLoading(btn, true, '切换中...');
        try {
            const itemName = document.getElementById('switchItemName').value;
            const res = await fetch('/api/envgroupswitch', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ groupName: this._switchTargetGroup, ItemName: itemName })
            });
            if (res.status === 403) {
                alert('需要管理员权限，请以管理员身份运行应用');
                return;
            }
            if (!res.ok) throw new Error('switch failed');
            this.closeModal();
            this.showToast('切换成功');
            // 刷新分组与变量视图
            await this.loadGroups();
            this.renderGroups();
            await this.loadEnvVars();
        } catch (e) {
            console.error(e);
            alert('切换失败');
        } finally {
            this.setButtonLoading(btn, false);
            this._switchingGroup = false;
        }
    }

    showAddGroupDialog() {
        const group = { name: '', remark: '', itemList: [] };
        this.openGroupEditor(group, false);
    }

    showEditGroupDialog(group) {
        const editable = JSON.parse(JSON.stringify(group || { name: '', remark: '', itemList: [] }));
        this.openGroupEditor(editable, true);
    }

    openGroupEditor(group, isEdit) {
        const title = isEdit ? '编辑分组' : '新建分组';
        const content = this.getGroupEditorContent(group, isEdit);
        this.showModal(content, title);
        const modalContent = document.getElementById('modalContent');
        modalContent.dataset.mode = isEdit ? 'edit' : 'create';
        this.initGroupEditorEvents();
        // 权限校验：非管理员禁用系统变量来源
        this.enforceGroupEnvSourcePermissions();
    }

    getGroupEditorContent(group, isEdit) {
        const itemsHtml = (group.itemList || []).map((item, idx) => this.buildGroupItemBlock(item, idx)).join('');
        return `
            <div class="space-y-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">分组名称</label>
                    <input type="text" id="groupName" ${isEdit ? 'readonly' : ''} value="${group.name || ''}" placeholder="请输入分组名称" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">备注</label>
                    <textarea id="groupRemark" rows="2" placeholder="备注(可选)" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm resize-none">${group.remark || ''}</textarea>
                </div>
                <div>
                    <div class="flex items-center justify-between mb-2">
                        <h4 class="text-sm font-medium text-gray-700">分组条目</h4>
                        <button id="btnAddGroupItem" class="px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm">添加条目</button>
                    </div>
                    <div id="groupItems">
                        ${itemsHtml}
                    </div>
                </div>
                <div class="flex justify-end space-x-3 pt-4">
                    <button onclick="envManager.closeModal()" class="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors duration-200">取消</button>
                    <button id="btnGroupConfirm" class="px-4 py-2 ${isEdit ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'} text-white rounded-md transition-colors duration-200">${isEdit ? '保存' : '创建分组'}</button>
                </div>
            </div>
        `;
    }

    buildGroupItemBlock(item = { name: '', remark: '', envList: [] }, idx = 0) {
        const envRows = (item.envList || []).map(env => this.buildEnvRow(env)).join('');
        return `
        <div class="group-item border border-gray-200 rounded-md p-3 mb-3">
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">条目名称</label>
                    <input type="text" class="gi-name w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" value="${item.name || ''}" placeholder="请输入条目名称">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">备注</label>
                    <input type="text" class="gi-remark w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" value="${item.remark || ''}" placeholder="备注(可选)">
                </div>
            </div>
            <div class="mt-3">
                <div class="flex items-center justify-between mb-2">
                    <span class="text-sm text-gray-700">变量列表</span>
                    <button class="btn-add-env px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-sm">添加变量</button>
                </div>
                <div class="env-list max-h-60 overflow-y-auto pr-1">
                    ${envRows}
                </div>
            </div>
            <div class="flex justify-end mt-3">
                <button class="btn-del-item text-red-600 hover:text-red-800 text-sm">删除条目</button>
            </div>
        </div>`;
    }

    buildEnvRow(env = { name: '', value: '', source: 'user', remark: '' }) {
        const esc = (s) => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        return `
        <div class="env-row grid grid-cols-12 gap-2 mb-2 items-center">
            <input class="env-name col-span-3 px-2 py-1 border border-gray-300 rounded" placeholder="变量名" value="${esc(env.name)}">
            <input class="env-value col-span-4 px-2 py-1 border border-gray-300 rounded" placeholder="变量值" value="${esc(env.value)}">
            <select class="env-source col-span-2 px-2 py-1 border border-gray-300 rounded" ${!this.isAdmin ? 'disabled' : ''}>
                <option value="user" ${env.source === 'user' ? 'selected' : ''}>用户</option>
                <option value="system" ${env.source === 'system' ? 'selected' : ''}>系统</option>
            </select>
            <input class="env-remark col-span-2 px-2 py-1 border border-gray-300 rounded" placeholder="备注(可选)" value="${esc(env.remark)}">
            <button class="btn-del-env col-span-1 text-red-600 hover:text-red-800 text-sm">删除</button>
        </div>`;
    }

    initGroupEditorEvents() {
        const modalContent = document.getElementById('modalContent');
        const confirmBtn = document.getElementById('btnGroupConfirm');
        if (!modalContent || !confirmBtn) return;
        const delegatedClick = async (e) => {
            const t = e.target;
            if (t.id === 'btnAddGroupItem') {
                const container = document.getElementById('groupItems');
                if (container) {
                    container.insertAdjacentHTML('beforeend', this.buildGroupItemBlock());
                }
                return;
            }
            if (t.classList.contains('btn-add-env')) {
                const itemEl = t.closest('.group-item');
                if (itemEl) {
                    const envList = itemEl.querySelector('.env-list');
                    envList.insertAdjacentHTML('beforeend', this.buildEnvRow());
                    // 新增行也要应用权限限制
                    this.enforceGroupEnvSourcePermissions();
                }
                return;
            }
            if (t.classList.contains('btn-del-env')) {
                const row = t.closest('.env-row');
                if (row) row.remove();
                return;
            }
            if (t.classList.contains('btn-del-item')) {
                const itemEl = t.closest('.group-item');
                if (itemEl) itemEl.remove();
                return;
            }
            if (t.id === 'btnGroupConfirm') {
                await this.submitGroupEditor();
                return;
            }
            if (t.id === 'btnSwitchConfirm') {
                await this.submitSwitchGroup();
                return;
            }
        };
        modalContent.addEventListener('click', delegatedClick, { once: false });
        modalContent.addEventListener('change', (e) => {
            const t = e.target;
            if (t && t.classList && t.classList.contains('env-source')) {
                if (!this.isAdmin && t.value === 'system') {
                    alert('需要管理员权限，请以管理员身份运行应用');
                    t.value = 'user';
                }
            }
        });
    }

    collectGroupFromEditor() {
        const name = (document.getElementById('groupName').value || '').trim();
        const remark = (document.getElementById('groupRemark').value || '').trim();
        if (!name) {
            alert('请输入分组名称');
            throw new Error('group name required');
        }
        const items = [];
        document.querySelectorAll('#groupItems .group-item').forEach(itemEl => {
            const itemName = itemEl.querySelector('.gi-name').value.trim();
            const itemRemark = itemEl.querySelector('.gi-remark').value.trim();
            const envList = [];
            itemEl.querySelectorAll('.env-list .env-row').forEach(envEl => {
                const en = envEl.querySelector('.env-name').value.trim();
                const ev = envEl.querySelector('.env-value').value.trim();
                const es = envEl.querySelector('.env-source').value;
                const er = envEl.querySelector('.env-remark').value.trim();
                if (!en || !ev) return;
                envList.push({ name: en, value: ev, source: es, remark: er });
            });
            if (!itemName) return;
            items.push({ name: itemName, remark: itemRemark, envList, selected: false });
        });
        return { name, remark, itemList: items };
    }

    async submitGroupEditor() {
        const mode = document.getElementById('modalContent').dataset.mode || 'create';
        const btn = document.getElementById('btnGroupConfirm');
        if (this._savingGroup) return;
        this._savingGroup = true;
        this.setButtonLoading(btn, true, mode === 'edit' ? '保存中...' : '创建中...');
        try {
            const group = this.collectGroupFromEditor();
            const res = await fetch('/api/envgroup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(group)
            });
            if (!res.ok) throw new Error('save group failed');
            this.closeModal();
            await this.loadGroups();
            this.renderGroups();
            this.showToast(mode === 'edit' ? '保存成功' : '分组创建成功');
        } catch (e) {
            console.error(e);
            alert(mode === 'edit' ? '保存分组失败' : '创建分组失败');
        } finally {
            this.setButtonLoading(btn, false);
            this._savingGroup = false;
        }
    }

    showDeleteGroupDialog(name) {
        const content = `
            <div class="space-y-4">
                <div class="bg-red-50 border border-red-200 rounded-md p-4">
                    <div class="flex">
                        <svg class="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
                        </svg>
                        <div>
                            <h3 class="text-sm font-medium text-red-800">确认删除</h3>
                            <p class="text-sm text-red-700 mt-1">确定要删除分组 "<strong>${name}</strong>" 吗？此操作无法撤销。</p>
                        </div>
                    </div>
                </div>
                <div class="flex justify-end space-x-3 pt-4">
                    <button onclick="envManager.closeModal()" class="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors duration-200">取消</button>
                    <button id="btnDeleteGroupConfirm" class="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors duration-200">删除</button>
                </div>
            </div>
        `;
        this.showModal(content, '删除分组');
        const btn = document.getElementById('btnDeleteGroupConfirm');
        if (btn) btn.addEventListener('click', () => this.deleteGroup(name), { once: true });
    }

    async deleteGroup(name) {
        if (this._deletingGroup) return;
        this._deletingGroup = true;
        const btn = document.getElementById('btnDeleteGroupConfirm');
        this.setButtonLoading(btn, true, '删除中...');
        try {
            const res = await fetch(`/api/envgroup?name=${encodeURIComponent(name)}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('delete group failed');
            this.closeModal();
            await this.loadGroups();
            this.renderGroups();
            this.showToast('删除成功');
        } catch (e) {
            console.error(e);
            alert('删除分组失败');
        } finally {
            this.setButtonLoading(btn, false);
            this._deletingGroup = false;
        }
    }

    showModal(content, title = '') {
        const modal = document.getElementById('modal');
        const modalContent = document.getElementById('modalContent');
        const modalTitle = document.getElementById('modalTitle');
        
        modalContent.innerHTML = content;
        if (title) {
            modalTitle.textContent = title;
        }
        // 限制内容最大高度并可滚动，避免大量表单元素时按钮被顶出视口
        modalContent.classList.add('max-h-[70vh]', 'overflow-y-auto');
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }

    closeModal() {
        const modal = document.getElementById('modal');
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }

    showAddDialog() {
        const content = `
            <div class="space-y-4">
                <div>
                    <label for="varName" class="block text-sm font-medium text-gray-700 mb-1">变量名称</label>
                    <input type="text" id="varName" placeholder="请输入变量名称" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                </div>
                <div>
                    <label for="varValue" class="block text-sm font-medium text-gray-700 mb-1">变量值</label>
                    <textarea id="varValue" rows="4" placeholder="请输入变量值" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm font-mono resize-y"></textarea>
                </div>
                <div>
                    <label for="varSource" class="block text-sm font-medium text-gray-700 mb-1">变量类型</label>
                    <select id="varSource" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                        <option value="user">用户变量</option>
                        <option value="system">系统变量</option>
                    </select>
                </div>
                <div>
                    <label for="varRemark" class="block text-sm font-medium text-gray-700 mb-1">备注 <span class="text-gray-500">(可选)</span></label>
                    <textarea id="varRemark" rows="2" placeholder="添加备注信息..." class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm resize-none"></textarea>
                    <div class="mt-1">
                        <span class="text-xs text-gray-500">备注信息将保存在本地，不会影响环境变量</span>
                    </div>
                </div>
                <div class="flex justify-end space-x-3 pt-4">
                    <button onclick="envManager.closeModal()" class="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors duration-200">取消</button>
                    <button id="btnAddConfirm" class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors duration-200">添加变量</button>
                </div>
            </div>
        `;
        this.showModal(content, '添加环境变量');

        // 兜底绑定，防止内联 onclick 被环境阻止
        const addBtn = document.getElementById('btnAddConfirm');
        if (addBtn) {
            addBtn.addEventListener('click', () => this.addVariable(), { once: true });
        }

        // 非管理员时禁用选择系统变量
        const varSource = document.getElementById('varSource');
        if (varSource && !this.isAdmin) {
            Array.from(varSource.options).forEach(opt => {
                if (opt.value === 'system') opt.disabled = true;
            });
            varSource.value = 'user';
        }
    }

    async addVariable() {
        const name = document.getElementById('varName').value.trim();
        const value = document.getElementById('varValue').value.trim();
        const source = document.getElementById('varSource').value;
        const remark = document.getElementById('varRemark').value.trim();
        
        if (!name || !value) {
            alert('请输入变量名和变量值');
            return;
        }
        
        if (this._adding) return;
        this._adding = true;
        const btn = document.getElementById('btnAddConfirm');
        this.setButtonLoading(btn, true, '添加中...');
        try {
            const response = await fetch('/api/env', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ name, value, source, remark }),
            });
            if (response.status === 403) {
                alert('需要管理员权限，请以管理员身份运行应用');
                return;
            }
            if (!response.ok) throw new Error('Failed to add variable');
            
            this.closeModal();
            await this.loadEnvVars();
            this.showToast('添加成功');
        } catch (error) {
            console.error('添加变量时出错:', error);
            alert('添加环境变量时出错');
        } finally {
            this.setButtonLoading(btn, false);
            this._adding = false;
        }
    }

    showInlineEditDialog(name, value) {
        const envVar = this.envVars.find(v => v.name === name && v.source === this.currentTab);
        const currentRemark = envVar ? (envVar.remark || '') : '';
        
        const content = `
            <div class="space-y-4">
                <div>
                    <label for="varName" class="block text-sm font-medium text-gray-700 mb-1">变量名称</label>
                    <input type="text" id="varName" value="${name}" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                    <div class="mt-1">
                        <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${this.currentTab === 'system' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}">
                            ${this.currentTab === 'system' ? '系统变量' : '用户变量'}
                        </span>
                    </div>
                </div>
                <div>
                    <label for="varValue" class="block text-sm font-medium text-gray-700 mb-1">变量值</label>
                    <textarea id="varValue" rows="6" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm font-mono resize-y">${(value || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</textarea>
                </div>
                <div>
                    <label for="varRemark" class="block text-sm font-medium text-gray-700 mb-1">备注 <span class="text-gray-500">(可选)</span></label>
                    <textarea id="varRemark" rows="2" placeholder="添加备注信息..." class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm resize-none">${currentRemark}</textarea>
                    <div class="mt-1">
                        <span class="text-xs text-gray-500">备注信息将保存在本地，不会影响环境变量</span>
                    </div>
                </div>
                <div class="flex justify-end space-x-3 pt-4">
                    <button onclick="envManager.closeModal()" class="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors duration-200">取消</button>
                    <button id="btnEditConfirm" class="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors duration-200">保存修改</button>
                </div>
            </div>
        `;
        this.showModal(content, '编辑环境变量');

        // 兜底绑定，防止内联 onclick 被环境阻止
        const editBtn = document.getElementById('btnEditConfirm');
        if (editBtn) {
            editBtn.addEventListener('click', () => this.editVariable(name), { once: true });
        }
    }

    showValueDetails(name, value, source) {
        const envVar = this.envVars.find(v => v.name === name && v.source === source);
        const currentRemark = envVar ? (envVar.remark || '') : '';
        
        const content = `
            <div class="space-y-4">
                <div>
                    <div class="flex items-center justify-between mb-1">
                        <label class="block text-sm font-medium text-gray-700">变量名称</label>
                        <button onclick="envManager.copyToClipboardDirect('${name.replace(/'/g, "\\'").replace(/"/g, '&quot;')}', this)" class="text-gray-400 hover:text-gray-600 transition-colors duration-200" title="复制变量名">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                            </svg>
                        </button>
                    </div>
                    <input type="text" value="${name}" readonly class="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500">
                    <div class="mt-1">
                        <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${source === 'system' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}">
                            ${source === 'system' ? '系统变量' : '用户变量'}
                        </span>
                    </div>
                </div>
                <div>
                    <div class="flex items-center justify-between mb-1">
                        <label class="block text-sm font-medium text-gray-700">变量值</label>
                        <button onclick="envManager.copyToClipboard()" class="text-gray-400 hover:text-gray-600 transition-colors duration-200" title="复制变量值">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                            </svg>
                        </button>
                    </div>
                    <div class="relative">
                        <textarea id="fullValue" readonly rows="6" class="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-700 font-mono text-sm resize-none">${value}</textarea>
                        <div class="mt-2">
                            <span class="text-xs text-gray-500">长度: ${value.length} 字符</span>
                        </div>
                    </div>
                </div>
                ${currentRemark ? `
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">备注</label>
                    <div class="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-700 text-sm whitespace-pre-wrap">${currentRemark}</div>
                </div>
                ` : ''}
                <div class="flex justify-end pt-4">
                    <button onclick="envManager.closeModal()" class="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors duration-200">关闭</button>
                </div>
            </div>
        `;
        this.showModal(content, '变量详情');
    }

    copyToClipboardDirect(text, buttonElement) {
        navigator.clipboard.writeText(text).then(() => {
            // Show success feedback
            const originalHTML = buttonElement.innerHTML;
            buttonElement.innerHTML = `
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                </svg>
            `;
            buttonElement.className = buttonElement.className.replace('text-gray-400 hover:text-gray-600', 'text-green-600');
            
            setTimeout(() => {
                buttonElement.innerHTML = originalHTML;
                buttonElement.className = buttonElement.className.replace('text-green-600', 'text-gray-400 hover:text-gray-600');
            }, 2000);
        }).catch(err => {
            console.error('复制失败:', err);
            alert('复制到剪贴板失败');
        });
    }

    copyToClipboard() {
        const textarea = document.getElementById('fullValue');
        const text = textarea.value;
        const btn = event.currentTarget;
        
        console.log('正在复制变量值，长度:', text.length);
        
        navigator.clipboard.writeText(text).then(() => {
            console.log('复制成功');
            // Show success feedback
            const originalHTML = btn.innerHTML;
            btn.innerHTML = `
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                </svg>
            `;
            btn.className = btn.className.replace('text-gray-400 hover:text-gray-600', 'text-green-600');
            
            setTimeout(() => {
                btn.innerHTML = originalHTML;
                btn.className = btn.className.replace('text-green-600', 'text-gray-400 hover:text-gray-600');
            }, 2000);
        }).catch(err => {
            console.error('复制失败:', err);
            alert('复制到剪贴板失败');
        });
    }

    showInlineDeleteDialog(name) {
        const content = `
            <div class="space-y-4">
                <div class="bg-red-50 border border-red-200 rounded-md p-4">
                    <div class="flex">
                        <svg class="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
                        </svg>
                        <div>
                            <h3 class="text-sm font-medium text-red-800">确认删除</h3>
                            <p class="text-sm text-red-700 mt-1">确定要删除变量 "<strong>${name}</strong>" 吗？此操作无法撤销。</p>
                        </div>
                    </div>
                </div>
                <div class="flex justify-end space-x-3 pt-4">
                    <button onclick="envManager.closeModal()" class="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors duration-200">取消</button>
                    <button id="btnDeleteConfirm" class="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors duration-200">删除变量</button>
                </div>
            </div>
        `;
        this.showModal(content, '删除环境变量');

        // 兜底绑定，防止内联 onclick 被环境阻止
        const delBtn = document.getElementById('btnDeleteConfirm');
        if (delBtn) {
            delBtn.addEventListener('click', () => this.deleteVariable(name), { once: true });
        }
    }

    async editVariable(oldName) {
        const newName = document.getElementById('varName').value.trim();
        const value = document.getElementById('varValue').value.trim();
        const remark = document.getElementById('varRemark').value.trim();
        
        if (!newName || !value) {
            alert('请输入变量名和变量值');
            return;
        }
        
        if (this._editing) return;
        this._editing = true;
        const btn = document.getElementById('btnEditConfirm');
        this.setButtonLoading(btn, true, '保存中...');
        try {
            // If name hasn't changed, just update the value
            if (newName === oldName) {
                const response = await fetch('/api/env', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ name: newName, value, source: this.currentTab, remark }),
                });
                if (response.status === 403) {
                    alert('需要管理员权限，请以管理员身份运行应用');
                    return;
                }
                if (!response.ok) throw new Error('Failed to edit variable');
            } else {
                // If name changed, delete old variable and create new one
                // Delete old variable
                const deleteResponse = await fetch(`/api/env?name=${encodeURIComponent(oldName)}&source=${this.currentTab}`, {
                    method: 'DELETE',
                });
                if (deleteResponse.status === 403) {
                    alert('需要管理员权限，请以管理员身份运行应用');
                    return;
                }
                if (!deleteResponse.ok) throw new Error('Failed to delete old variable');
                
                // Create new variable with new name
                const createResponse = await fetch('/api/env', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ name: newName, value, source: this.currentTab, remark }),
                });
                if (createResponse.status === 403) {
                    alert('需要管理员权限，请以管理员身份运行应用');
                    return;
                }
                if (!createResponse.ok) throw new Error('Failed to create new variable');
            }
            
            this.closeModal();
            await this.loadEnvVars();
            this.showToast('保存成功');
        } catch (error) {
            console.error('编辑变量时出错:', error);
            alert('编辑环境变量时出错');
        } finally {
            this.setButtonLoading(btn, false);
            this._editing = false;
        }
    }

    async deleteVariable(name) {
        if (this._deleting) return;
        this._deleting = true;
        const btn = document.getElementById('btnDeleteConfirm');
        this.setButtonLoading(btn, true, '删除中...');
        try {
            const response = await fetch(`/api/env?name=${encodeURIComponent(name)}&source=${this.currentTab}`, {
                method: 'DELETE',
            });
            if (response.status === 403) {
                alert('需要管理员权限，请以管理员身份运行应用');
                return;
            }
            if (!response.ok) throw new Error('Failed to delete variable');
            
            this.closeModal();
            await this.loadEnvVars();
            this.showToast('删除成功');
        } catch (error) {
            console.error('删除变量时出错:', error);
            alert('删除环境变量时出错');
        } finally {
            this.setButtonLoading(btn, false);
            this._deleting = false;
        }
    }

  
}

// Initialize the application (attach to window for inline handlers)
if (!window.envManager && window.envManagerInitialized) {
    console.log('[envmgr] bootstrap instance');
    window.envManager = new EnvironmentManager();
}