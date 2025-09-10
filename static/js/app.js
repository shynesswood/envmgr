class EnvironmentManager {
    constructor() {
        this.envVars = []; // 现在是对象数组而不是map
        this.currentTab = 'user'; // 当前选中的tab：'user' 或 'system'
        this.init();
    }

    async init() {
        await this.loadEnvVars();
        this.setupEventListeners();
    }

    async loadEnvVars() {
        try {
            const response = await fetch('/api/env');
            if (!response.ok) throw new Error('Failed to load environment variables');
            this.envVars = await response.json();
            this.renderTable();
            this.updateVariableCounts();
        } catch (error) {
            console.error('加载环境变量时出错:', error);
            alert('加载环境变量时出错');
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
            
            if (envVar.source === 'system') {
                // 系统变量显示只读标签
                const readOnlyLabel = document.createElement('span');
                readOnlyLabel.className = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800';
                readOnlyLabel.textContent = '只读';
                actionCell.appendChild(readOnlyLabel);
            } else {
                // 用户变量显示编辑和删除按钮
                const editBtn = document.createElement('button');
                editBtn.className = 'text-indigo-600 hover:text-indigo-900 mr-3 transition-colors duration-200';
                editBtn.innerHTML = `
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                    </svg>
                `;
                editBtn.title = '编辑变量';
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
                deleteBtn.title = '删除变量';
                deleteBtn.onclick = (e) => {
                    e.stopPropagation();
                    this.showInlineDeleteDialog(envVar.name);
                };
                
                actionCell.appendChild(editBtn);
                actionCell.appendChild(deleteBtn);
            }
            
            row.appendChild(nameCell);
            row.appendChild(valueCell);
            row.appendChild(actionCell);
            
            tbody.appendChild(row);
        });

        // Update variable count for current tab
        document.getElementById('varCount').textContent = filteredVars.length;
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
        
        this.renderTable();
    }

    updateVariableCounts() {
        const userVars = this.envVars.filter(envVar => envVar.source === 'user');
        const systemVars = this.envVars.filter(envVar => envVar.source === 'system');
        
        document.getElementById('userVarCount').textContent = userVars.length;
        document.getElementById('systemVarCount').textContent = systemVars.length;
    }

    setupEventListeners() {
        document.getElementById('addBtn').addEventListener('click', () => this.showAddDialog());
        
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

    showModal(content, title = '') {
        const modal = document.getElementById('modal');
        const modalContent = document.getElementById('modalContent');
        const modalTitle = document.getElementById('modalTitle');
        
        modalContent.innerHTML = content;
        if (title) {
            modalTitle.textContent = title;
        }
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
                    <input type="text" id="varValue" placeholder="请输入变量值" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                </div>
                <div class="flex justify-end space-x-3 pt-4">
                    <button onclick="envManager.closeModal()" class="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors duration-200">取消</button>
                    <button onclick="envManager.addVariable()" class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors duration-200">添加变量</button>
                </div>
            </div>
        `;
        this.showModal(content, '添加环境变量');
    }

    async addVariable() {
        const name = document.getElementById('varName').value.trim();
        const value = document.getElementById('varValue').value.trim();
        
        if (!name || !value) {
            alert('请输入变量名和变量值');
            return;
        }
        
        try {
            const response = await fetch('/api/env', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ name, value }),
            });
            
            if (!response.ok) throw new Error('Failed to add variable');
            
            this.closeModal();
            await this.loadEnvVars();
        } catch (error) {
            console.error('添加变量时出错:', error);
            alert('添加环境变量时出错');
        }
    }

    showInlineEditDialog(name, value) {
        const content = `
            <div class="space-y-4">
                <div>
                    <label for="varName" class="block text-sm font-medium text-gray-700 mb-1">变量名称</label>
                    <input type="text" id="varName" value="${name}" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                    <div class="mt-1">
                        <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                            用户变量
                        </span>
                    </div>
                </div>
                <div>
                    <label for="varValue" class="block text-sm font-medium text-gray-700 mb-1">变量值</label>
                    <input type="text" id="varValue" value="${value}" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                </div>
                <div class="flex justify-end space-x-3 pt-4">
                    <button onclick="envManager.closeModal()" class="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors duration-200">取消</button>
                    <button onclick="envManager.editVariable('${name}')" class="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors duration-200">保存修改</button>
                </div>
            </div>
        `;
        this.showModal(content, '编辑环境变量');
    }

    showValueDetails(name, value, source) {
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
                    <button onclick="envManager.deleteVariable('${name}')" class="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors duration-200">删除变量</button>
                </div>
            </div>
        `;
        this.showModal(content, '删除环境变量');
    }

    async editVariable(oldName) {
        const newName = document.getElementById('varName').value.trim();
        const value = document.getElementById('varValue').value.trim();
        
        if (!newName || !value) {
            alert('请输入变量名和变量值');
            return;
        }
        
        try {
            // If name hasn't changed, just update the value
            if (newName === oldName) {
                const response = await fetch('/api/env', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ name: newName, value }),
                });
                
                if (!response.ok) throw new Error('Failed to edit variable');
            } else {
                // If name changed, delete old variable and create new one
                // Delete old variable
                const deleteResponse = await fetch(`/api/env?name=${encodeURIComponent(oldName)}`, {
                    method: 'DELETE',
                });
                
                if (!deleteResponse.ok) throw new Error('Failed to delete old variable');
                
                // Create new variable with new name
                const createResponse = await fetch('/api/env', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ name: newName, value }),
                });
                
                if (!createResponse.ok) throw new Error('Failed to create new variable');
            }
            
            this.closeModal();
            await this.loadEnvVars();
        } catch (error) {
            console.error('编辑变量时出错:', error);
            alert('编辑环境变量时出错');
        }
    }

    async deleteVariable(key) {
        try {
            const response = await fetch(`/api/env?name=${encodeURIComponent(key)}`, {
                method: 'DELETE',
            });
            
            if (!response.ok) throw new Error('Failed to delete variable');
            
            this.closeModal();
            await this.loadEnvVars();
        } catch (error) {
            console.error('删除变量时出错:', error);
            alert('删除环境变量时出错');
        }
    }

    async showSaveProfileDialog() {
        const content = `
            <div class="space-y-4">
                <div>
                    <label for="profileName" class="block text-sm font-medium text-gray-700 mb-1">配置名称</label>
                    <input type="text" id="profileName" placeholder="请输入配置名称" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500">
                </div>
                <div class="flex justify-end space-x-3 pt-4">
                    <button onclick="envManager.closeModal()" class="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors duration-200">取消</button>
                    <button onclick="envManager.saveProfile()" class="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors duration-200">保存配置</button>
                </div>
            </div>
        `;
        this.showModal(content, '保存环境配置');
    }

    async saveProfile() {
        const name = document.getElementById('profileName').value.trim();
        
        if (!name) {
            alert('请输入配置文件名称');
            return;
        }
        
        try {
            // 转换为map格式以兼容后端API
            const varsMap = {};
            this.envVars.forEach(envVar => {
                varsMap[envVar.name] = envVar.value;
            });
            
            const response = await fetch('/api/profile/save', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ name, vars: varsMap }),
            });
            
            if (!response.ok) throw new Error('Failed to save profile');
            
            this.closeModal();
            alert('配置保存成功');
        } catch (error) {
            console.error('保存配置时出错:', error);
            alert('保存配置时出错');
        }
    }

    async showLoadProfileDialog() {
        try {
            const response = await fetch('/api/profiles');
            if (!response.ok) throw new Error('Failed to load profiles');
            const profiles = await response.json();
            
            if (profiles.length === 0) {
                alert('没有可用的配置文件');
                return;
            }
            
            const options = profiles.map(p => `<option value="${p.name}">${p.name}</option>`).join('');
            
            const content = `
                <div class="space-y-4">
                    <div>
                        <label for="profileSelect" class="block text-sm font-medium text-gray-700 mb-1">选择配置</label>
                        <select id="profileSelect" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
                            ${options}
                        </select>
                    </div>
                    <div class="flex justify-end space-x-3 pt-4">
                        <button onclick="envManager.closeModal()" class="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors duration-200">取消</button>
                        <button onclick="envManager.loadProfile()" class="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors duration-200">加载配置</button>
                    </div>
                </div>
            `;
            this.showModal(content, '加载环境配置');
        } catch (error) {
            console.error('加载配置列表时出错:', error);
            alert('加载配置列表时出错');
        }
    }

    async loadProfile() {
        const select = document.getElementById('profileSelect');
        const profileName = select.value;
        
        try {
            const response = await fetch('/api/profile/apply', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ name: profileName }),
            });
            
            if (!response.ok) throw new Error('Failed to apply profile');
            
            this.closeModal();
            await this.loadEnvVars();
            alert('配置应用成功');
        } catch (error) {
            console.error('应用配置时出错:', error);
            alert('应用配置时出错');
        }
    }
}

// Initialize the application
const envManager = new EnvironmentManager();