(function() {
    const getPageName = () => {
        try {
            const path = window.location.pathname;
            const cleanPath = path.split('?')[0].split('#')[0];
            // 提取文件名，例如 /a/b/login.html -> login.html
            const page = cleanPath.replace(/\\/g, '/').split('/').filter(Boolean).pop();
            
            if (!page || page === '' || cleanPath.endsWith('/')) return 'index.html';
            return page;
        } catch (e) {
            console.error('[AuthGuard] 获取页面名称失败:', e);
            return 'index.html';
        }
    };

    // 核心判定逻辑：以下页面是公开的（无需登录即可查看）
    const PUBLIC_PAGES = ['index.html', 'home-dashboard.html', 'login.html'];
    
    // 如果是根目录，getPageName 会返回 index.html
    const currentPage = getPageName();
    
    // 检查当前页面是否在公开列表中
    const isPublic = PUBLIC_PAGES.some(p => currentPage.toLowerCase() === p.toLowerCase());
    const isProtected = !isPublic;

    console.log('[AuthGuard] 运行环境:', {
        pathname: window.location.pathname,
        currentPage: currentPage,
        isProtected: isProtected,
        isPublic: isPublic
    });

    const checkAuth = () => {
        const userJson = localStorage.getItem('user');
        console.log('[AuthGuard] 检查登录状态:', {
            hasUserJson: !!userJson,
            currentPage: currentPage,
            isProtected: isProtected
        });
        
        if (userJson && userJson !== 'undefined' && userJson !== 'null') {
            try {
                const user = JSON.parse(userJson);
                if (!user || !user.username) {
                    throw new Error('用户信息字段缺失');
                }
                
                window.currentUser = user;
                console.log('[AuthGuard] 验证通过:', user.username);
                
                // 只要登录了，就在所有页面尝试更新 UI
                updateUIForLoggedInUser(user);
                
                // 如果已登录但在登录页，跳转到仪表盘
                if (currentPage.toLowerCase() === 'login.html') {
                    const params = new URLSearchParams(window.location.search);
                    let redirect = params.get('redirect') || 'home-dashboard.html';
                    
                    // 安全检查：防止重定向回登录页导致死循环
                    if (redirect.toLowerCase().includes('login.html')) {
                        console.warn('[AuthGuard] 检测到重定向循环，强制跳转至仪表盘');
                        redirect = 'home-dashboard.html';
                    }
                    
                    console.log('[AuthGuard] 已登录用户访问登录页，重定向至:', redirect);
                    window.location.replace(redirect);
                    return;
                }
            } catch (e) {
                console.error('[AuthGuard] 登录信息异常:', e.message);
                localStorage.removeItem('user');
                handleUnauthenticated();
            }
        } else {
            console.log('[AuthGuard] 未登录');
            handleUnauthenticated();
        }
    };

    // 执行初始化检查
    checkAuth();

    function handleUnauthenticated() {
        if (isProtected) {
            console.warn('[AuthGuard] 拦截未授权访问:', window.location.href);
            // 记录当前的完整 URL 作为重定向参数
            const currentUrl = window.location.href;
            window.location.href = 'login.html?redirect=' + encodeURIComponent(currentUrl);
        } else {
            console.log('[AuthGuard] 公开页面，无需登录');
        }
    }

    function updateUIForLoggedInUser(user) {
        // 数据大屏和仪表盘首页不显示用户信息
        const NO_USER_INFO_PAGES = ['home-dashboard.html', 'index.html'];
        if (NO_USER_INFO_PAGES.some(p => currentPage.toLowerCase() === p.toLowerCase())) {
            console.log('[AuthGuard] 当前页面不显示用户信息面板');
            return;
        }

        // 使用事件委托处理退出按钮，防止 DOM 重绘导致监听器失效
        if (!window.__authEventBound) {
            document.addEventListener('click', (e) => {
                const btn = e.target.closest('#logoutBtn');
                if (btn) {
                    console.log('[AuthGuard] 执行退出登录');
                    
                    // 尝试通知后端退出
                    try {
                        const API_HOST = window.location.hostname;
                        fetch(`http://${API_HOST}:3001/logout`, { 
                            method: 'POST',
                            credentials: 'include'
                        }).catch(e => console.warn('后端退出请求失败:', e));
                    } catch (e) {}

                    localStorage.removeItem('user');
                    window.location.href = 'login.html';
                }
            });
            window.__authEventBound = true;
        }

        const injectUI = () => {
            const header = document.querySelector('header');
            if (!header) return;
            
            // 如果已经存在，则跳过
            if (document.getElementById('user-panel')) return;

            const userPanel = document.createElement('div');
            userPanel.id = 'user-panel';
            userPanel.className = 'flex items-center gap-3 ml-4 pl-4 border-l border-slate-200/20';
            userPanel.innerHTML = `
                <div class="flex flex-col items-end">
                    <span class="text-xs font-bold text-blue-400">${user.name || user.username}</span>
                    <span class="text-[10px] text-slate-400">${user.role === 'admin' ? '总管理员' : '教师'}</span>
                </div>
                <button id="logoutBtn" class="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-500 transition-all shadow-sm" title="退出登录">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path>
                    </svg>
                </button>
            `;
            
            // 尝试寻找右侧按钮容器
            const rightContainer = header.querySelector('.flex.items-center.gap-4:last-child') || 
                                 header.querySelector('.flex.items-center:last-child') || 
                                 header;
            rightContainer.appendChild(userPanel);
        };

        // 初始注入
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', injectUI);
        } else {
            injectUI();
        }

        // 确保 body 存在后再观察
        const startObserver = () => {
            if (!document.body) {
                setTimeout(startObserver, 50);
                return;
            }
            if (window.__authObserver) window.__authObserver.disconnect();
            window.__authObserver = new MutationObserver(() => {
                if (!document.getElementById('user-panel')) injectUI();
            });
            window.__authObserver.observe(document.body, { childList: true, subtree: true });
        };
        startObserver();
    }

    // 立即执行检查
    checkAuth();

    // 全局日志方法
    window.logAction = (action, details) => {
        console.log(`[Log] ${action}:`, details);
    };
})();