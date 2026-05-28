// State Management
const state = {
    currentUser: null,
    view: 'habits',
    selectedDate: new Date(),
    habits: [],
    logs: {}, 
    timer: {
        interval: null,
        startTime: null,
        seconds: 0,
        habitId: null
    },
    analyticsFilter: 'week',
    chartColors: ['#bc13fe', '#ff007f', '#00f2ff', '#10b981', '#f59e0b', '#ef4444', '#6366f1', '#a855f7']
};

const utils = {
    saveToLocal: (key, data) => localStorage.setItem(key, JSON.stringify(data)),
    getFromLocal: (key) => JSON.parse(localStorage.getItem(key)),
    formatDate: (date) => {
        const y = date.getFullYear();
        const m = (date.getMonth() + 1).toString().padStart(2, '0');
        const d = date.getDate().toString().padStart(2, '0');
        return `${y}-${m}-${d}`;
    },
    getDisplayDate: (date) => {
        const today = utils.formatDate(new Date());
        const target = utils.formatDate(date);
        if (today === target) return 'Today';
        return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    },
    formatSeconds: (totalSeconds) => {
        const sec = parseInt(totalSeconds) || 0;
        const h = Math.floor(sec / 3600);
        const m = Math.floor((sec % 3600) / 60);
        const s = sec % 60;
        return `${h > 0 ? h + 'h ' : ''}${m}m ${s}s`;
    }
};

const auth = {
    signup: () => {
        const user = document.getElementById('signup-username').value.trim();
        const pass = document.getElementById('signup-password').value.trim();
        if (!user || !pass) return alert('Fill all fields');
        const users = utils.getFromLocal('habitask_users') || {};
        if (users[user]) return alert('User already exists');
        users[user] = { password: pass, habits: [], logs: {} };
        utils.saveToLocal('habitask_users', users);
        alert('Account created! Please login.');
        ui.toggleAuth(false);
    },
    login: () => {
        const user = document.getElementById('login-username').value.trim();
        const pass = document.getElementById('login-password').value.trim();
        const users = utils.getFromLocal('habitask_users') || {};
        if (users[user] && users[user].password === pass) {
            state.currentUser = user;
            state.habits = users[user].habits || [];
            state.logs = users[user].logs || {};
            localStorage.setItem('habitask_logged_in', user);
            ui.showApp();
        } else {
            alert('Invalid credentials');
        }
    },
    logout: () => {
        localStorage.removeItem('habitask_logged_in');
        location.reload();
    },
    checkSession: () => {
        const user = localStorage.getItem('habitask_logged_in');
        if (user) {
            const users = utils.getFromLocal('habitask_users') || {};
            if (users[user]) {
                state.currentUser = user;
                state.habits = users[user].habits || [];
                state.logs = users[user].logs || {};
                ui.showApp();
            }
        }
    }
};

const habits = {
    add: () => {
        const nameInput = document.getElementById('new-habit-name');
        const name = nameInput.value.trim();
        if (!name) return;
        const newHabit = { id: Date.now(), name: name };
        state.habits.push(newHabit);
        nameInput.value = '';
        habits.save();
        ui.renderHabits();
    },
    delete: (id) => {
        state.habits = state.habits.filter(h => h.id !== id);
        habits.save();
        ui.renderHabits();
    },
    toggle: (id) => {
        const dateStr = utils.formatDate(state.selectedDate);
        if (!state.logs[dateStr]) state.logs[dateStr] = {};
        if (!state.logs[dateStr][id]) state.logs[dateStr][id] = { completed: false, secondsSpent: 0 };
        state.logs[dateStr][id].completed = !state.logs[dateStr][id].completed;
        habits.save();
        ui.renderHabits();
    },
    changeDate: (offset) => {
        state.selectedDate.setDate(state.selectedDate.getDate() + offset);
        ui.renderHabits();
    },
    save: () => {
        const users = utils.getFromLocal('habitask_users');
        if (users && state.currentUser) {
            users[state.currentUser].habits = state.habits;
            users[state.currentUser].logs = state.logs;
            utils.saveToLocal('habitask_users', users);
        }
    }
};

const timer = {
    open: (habitId, habitName) => {
        state.timer.habitId = habitId;
        state.timer.seconds = 0;
        document.getElementById('timer-habit-name').innerText = habitName;
        document.getElementById('timer-clock').innerText = '00:00:00';
        document.getElementById('timer-modal').classList.remove('hidden');
        document.getElementById('manual-time-input').value = '';
    },
    start: () => {
        state.timer.startTime = Date.now() - (state.timer.seconds * 1000);
        state.timer.interval = setInterval(() => {
            state.timer.seconds = Math.floor((Date.now() - state.timer.startTime) / 1000);
            ui.updateTimerDisplay();
        }, 1000);
        document.getElementById('timer-start').classList.add('hidden');
        document.getElementById('timer-pause').classList.remove('hidden');
    },
    pause: () => {
        clearInterval(state.timer.interval);
        document.getElementById('timer-start').classList.remove('hidden');
        document.getElementById('timer-pause').classList.add('hidden');
    },
    stop: () => {
        clearInterval(state.timer.interval);
        if (state.timer.seconds > 0) timer.addTime(state.timer.habitId, state.timer.seconds);
        ui.closeTimer();
    },
    saveManual: () => {
        const mins = parseInt(document.getElementById('manual-time-input').value);
        if (!isNaN(mins) && mins >= 0) {
            timer.addTime(state.timer.habitId, mins * 60);
            ui.closeTimer();
        }
    },
    addTime: (id, seconds) => {
        const dateStr = utils.formatDate(state.selectedDate);
        if (!state.logs[dateStr]) state.logs[dateStr] = {};
        if (!state.logs[dateStr][id]) state.logs[dateStr][id] = { completed: false, secondsSpent: 0 };
        state.logs[dateStr][id].secondsSpent = (state.logs[dateStr][id].secondsSpent || 0) + seconds;
        if (seconds > 0) {
            state.logs[dateStr][id].completed = true;
        }
        habits.save();
        ui.renderHabits();
    }
};

const analytics = {
    setFilter: (filter) => {
        state.analyticsFilter = filter;
        document.querySelectorAll('.filter-group button').forEach(b => b.classList.remove('active'));
        document.getElementById(`filter-${filter}`).classList.add('active');
        ui.renderAnalytics();
    },
    getData: () => {
        const days = state.analyticsFilter === 'week' ? 7 : state.analyticsFilter === 'month' ? 30 : 365;
        const results = state.habits.map((h, i) => ({
            id: h.id,
            name: h.name,
            count: 0,
            seconds: 0,
            color: state.chartColors[i % state.chartColors.length]
        }));
        
        const now = new Date();
        for (let i = 0; i < days; i++) {
            const d = new Date();
            d.setDate(now.getDate() - i);
            const dateStr = utils.formatDate(d);
            const log = state.logs[dateStr];
            if (log) {
                results.forEach(res => {
                    if (log[res.id]) {
                        if (log[res.id].completed) res.count++;
                        res.seconds += log[res.id].secondsSpent || 0;
                    }
                });
            }
        }
        return results;
    }
};

const ui = {
    toggleAuth: (showSignup) => {
        document.getElementById('login-form').classList.toggle('hidden', showSignup);
        document.getElementById('signup-form').classList.toggle('hidden', !showSignup);
        lucide.createIcons();
    },
    showApp: () => {
        document.getElementById('auth-container').classList.add('hidden');
        document.getElementById('app-container').classList.remove('hidden');
        ui.renderHabits();
        lucide.createIcons();
    },
    switchPage: (page) => {
        state.view = page;
        document.getElementById('habits-page').classList.toggle('hidden', page !== 'habits');
        document.getElementById('analytics-page').classList.toggle('hidden', page !== 'analytics');
        document.getElementById('nav-habits').classList.toggle('active', page === 'habits');
        document.getElementById('nav-analytics').classList.toggle('active', page === 'analytics');
        if (page === 'analytics') ui.renderAnalytics();
        lucide.createIcons();
    },
    renderHabits: () => {
        const list = document.getElementById('habits-list');
        const dateStr = utils.formatDate(state.selectedDate);
        document.getElementById('current-date-display').innerText = utils.getDisplayDate(state.selectedDate);
        list.innerHTML = '';
        state.habits.forEach(habit => {
            const log = (state.logs[dateStr] && state.logs[dateStr][habit.id]) || { completed: false, secondsSpent: 0 };
            const div = document.createElement('div');
            div.className = 'habit-item';
            div.onclick = () => timer.open(habit.id, habit.name);
            div.innerHTML = `
                <div class="habit-info">
                    <div class="habit-name">${habit.name}</div>
                    <div class="habit-meta">
                        <i data-lucide="clock" style="width:14px; height:14px;"></i>
                        <span>${utils.formatSeconds(log.secondsSpent || 0)} tracked</span>
                    </div>
                </div>
                <div class="habit-actions">
                    <button class="toggle-btn ${log.completed ? 'complete' : ''}" onclick="event.stopPropagation(); habits.toggle(${habit.id})">
                        ${log.completed ? 'Completed' : 'Complete'}
                    </button>
                    <button class="delete-btn" onclick="event.stopPropagation(); habits.delete(${habit.id})">
                        <i data-lucide="trash-2" style="width:20px;"></i>
                    </button>
                </div>
            `;
            list.appendChild(div);
        });
        lucide.createIcons();
    },
    updateTimerDisplay: () => {
        const h = Math.floor(state.timer.seconds / 3600).toString().padStart(2, '0');
        const m = Math.floor((state.timer.seconds % 3600) / 60).toString().padStart(2, '0');
        const s = (state.timer.seconds % 60).toString().padStart(2, '0');
        document.getElementById('timer-clock').innerText = `${h}:${m}:${s}`;
    },
    closeTimer: () => {
        clearInterval(state.timer.interval);
        document.getElementById('timer-modal').classList.add('hidden');
        document.getElementById('timer-start').classList.remove('hidden');
        document.getElementById('timer-pause').classList.add('hidden');
    },
    renderAnalytics: () => {
        const data = analytics.getData();
        const periodDays = state.analyticsFilter === 'week' ? 7 : state.analyticsFilter === 'month' ? 30 : 365;
        
        ui.drawPieChart('completions-chart', data, 'count', 'Completions', periodDays);
        ui.drawPieChart('time-chart', data, 'seconds', 'Time');
        lucide.createIcons();
    },
    drawPieChart: (containerId, data, key, label, totalPeriodDays = null) => {
        const container = document.getElementById(containerId);
        container.innerHTML = '';
        const filteredData = data.filter(d => d[key] > 0);
        const total = filteredData.reduce((sum, d) => sum + d[key], 0);
        if (total === 0) {
            container.innerHTML = `<p class="chart-empty-msg">No data for this period.</p>`;
            return;
        }
        let cumulativePercent = 0;
        const radius = 25;
        const circumference = 2 * Math.PI * radius;
        let svgHtml = `<div class="pie-chart-wrapper"><svg viewBox="0 0 100 100" class="pie-chart-svg" width="200" height="200">`;
        filteredData.forEach(d => {
            const percent = (d[key] / total) * 100;
            const offset = (cumulativePercent / 100) * circumference;
            svgHtml += `<circle class="pie-segment" cx="50" cy="50" r="${radius}" stroke="${d.color}" stroke-dasharray="${(percent / 100) * circumference} ${circumference}" stroke-dashoffset="-${offset}"></circle>`;
            cumulativePercent += percent;
        });
        svgHtml += `</svg></div><div class="chart-legend">`;
        filteredData.forEach(d => {
            let valDisplay;
            if (key === 'seconds') {
                valDisplay = utils.formatSeconds(d[key]);
            } else if (key === 'count' && totalPeriodDays) {
                const missed = totalPeriodDays - d[key];
                valDisplay = `${d[key]} of ${totalPeriodDays} days ${missed > 0 ? `(${missed} missed)` : ''}`;
            } else {
                valDisplay = d[key];
            }
            
            const pct = ((d[key] / total) * 100).toFixed(1);
            svgHtml += `
                <div class="legend-item">
                    <span class="legend-color" style="background: ${d.color}"></span>
                    <span>${d.name}: <strong>${valDisplay}</strong> (${pct}%)</span>
                </div>`;
        });
        svgHtml += `</div>`;
        container.innerHTML = svgHtml;
    }
};

auth.checkSession();
window.auth = auth; window.ui = ui; window.habits = habits; window.timer = timer; window.analytics = analytics;
lucide.createIcons();
