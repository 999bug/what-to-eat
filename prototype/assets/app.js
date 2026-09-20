/* 今天吃什么 · 交互原型 */
(function () {
  'use strict';

  var DISHES = window.DISHES;
  var CUISINES = window.CUISINES;
  var TAG_META = window.TAG_META;
  var AVOID_META = window.AVOID_META;
  var MEALS = [
    { id: 'b', name: '早餐' },
    { id: 'l', name: '午餐' },
    { id: 'd', name: '晚餐' },
    { id: 'm', name: '夜宵' }
  ];
  var KEY = 'wte:v1:';
  var DAY = ['一', '二', '三', '四', '五', '六', '日'];

  /* ---------- 工具 ---------- */
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parseYmd(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function today() { return ymd(new Date()); }
  function daysBetween(a, b) { return Math.abs((parseYmd(a) - parseYmd(b)) / 86400000); }
  function cuisineName(id) { for (var i = 0; i < CUISINES.length; i++) if (CUISINES[i].id === id) return CUISINES[i].name; return id; }
  function mealName(id) { for (var i = 0; i < MEALS.length; i++) if (MEALS[i].id === id) return MEALS[i].name; return id; }
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function cls(on) { return on ? ' on' : ''; }

  /* ---------- 存储 ---------- */
  var mem = {};
  function load(k, d) {
    try { var v = localStorage.getItem(KEY + k); return v == null ? d : JSON.parse(v); }
    catch (e) { return mem[k] === undefined ? d : mem[k]; }
  }
  function save(k, v) {
    mem[k] = v;
    try { localStorage.setItem(KEY + k, JSON.stringify(v)); } catch (e) {}
  }

  var DEFAULT_SETTINGS = {
    theme: 'dark', midnight: false, serving: 1,
    goalOn: false, goal: 1800, avoid: [], dedupe: true, mode: 'wheel'
  };

  var settings = Object.assign({}, DEFAULT_SETTINGS, load('settings', {}));
  var records = load('records', null);
  var favorites = load('favorites', []);

  var state = {
    view: 'draw',
    meal: mealByTime(),
    filterCuisines: [],
    filterTags: [],
    candidates: [],
    result: null,
    spinning: false,
    wheelRot: 0,
    shownIds: [],
    selDate: today(),
    month: today().slice(0, 7),
    sheet: null,
    pickMealFor: null
  };

  function mealByTime() {
    var h = new Date().getHours();
    if (h < 10) return 'b';
    if (h < 15) return 'l';
    if (h < 21) return 'd';
    return settings.midnight ? 'm' : 'd';
  }

  if (records === null) { records = seedRecords(); save('records', records); }

  /* ---------- 示例数据（确定性） ---------- */
  function seedRecords() {
    var rnd = mulberry32(20260920);
    var out = [];
    var now = new Date();
    var y = now.getFullYear(), m = now.getMonth(), todayD = now.getDate();
    function poolFor(meal) {
      return DISHES.filter(function (d) { return d.meals.indexOf(meal) >= 0; });
    }
    function add(date, meal, dish) {
      out.push({
        id: 'r' + (out.length + 1),
        date: date, meal: meal,
        dishId: dish.id, dishName: dish.name, icon: dish.icon,
        cuisine: dish.cuisines[0],
        servings: rnd() < 0.25 ? 1.5 : 1,
        kcal: Math.round(dish.kcal * (rnd() < 0.25 ? 1.5 : 1)),
        source: 'seed',
        createdAt: date + 'T12:00:00'
      });
    }
    for (var d = 1; d < todayD; d++) {
      if (rnd() > 0.62) continue;
      var date = ymd(new Date(y, m, d));
      var lp = poolFor('l'), dp = poolFor('d'), bp = poolFor('b'), mp = poolFor('m');
      if (rnd() < 0.55) add(date, 'b', bp[Math.floor(rnd() * bp.length)]);
      add(date, 'l', lp[Math.floor(rnd() * lp.length)]);
      if (rnd() < 0.78) add(date, 'd', dp[Math.floor(rnd() * dp.length)]);
      if (rnd() < 0.16) add(date, 'm', mp[Math.floor(rnd() * mp.length)]);
    }
    var td = ymd(now);
    add(td, 'b', poolFor('b')[Math.floor(rnd() * poolFor('b').length)]);
    return out;
  }

  /* ---------- 业务 ---------- */
  function avoidHit(d) {
    if (!settings.avoid.length) return false;
    var text = d.name + d.ingredients;
    return settings.avoid.some(function (id) {
      var meta = null;
      for (var i = 0; i < AVOID_META.length; i++) if (AVOID_META[i].id === id) meta = AVOID_META[i];
      if (!meta) return false;
      if (meta.tag && d.tags.indexOf(meta.tag) >= 0) return true;
      return meta.kw.some(function (w) { return text.indexOf(w) >= 0; });
    });
  }

  function poolForMeal(meal) {
    return DISHES.filter(function (d) {
      if (d.meals.indexOf(meal) < 0) return false;
      if (state.filterCuisines.length &&
        !d.cuisines.some(function (c) { return state.filterCuisines.indexOf(c) >= 0; })) return false;
      if (state.filterTags.length &&
        !state.filterTags.some(function (t) { return d.tags.indexOf(t) >= 0; })) return false;
      return !avoidHit(d);
    });
  }

  function weightFor(d) {
    var w = 1;
    if (settings.dedupe) {
      var recent = records.some(function (r) { return r.dishId === d.id && daysBetween(r.date, today()) <= 7; });
      if (recent) w *= 0.3;
    }
    if (favorites.indexOf(d.id) >= 0) w *= 1.5;
    return w;
  }

  function pick(pool, excludeIds) {
    var items = pool.filter(function (d) { return !excludeIds || excludeIds.indexOf(d.id) < 0; });
    if (!items.length) items = pool;
    if (!items.length) return null;
    var total = 0, i;
    for (i = 0; i < items.length; i++) total += weightFor(items[i]);
    var r = Math.random() * total;
    for (i = 0; i < items.length; i++) {
      r -= weightFor(items[i]);
      if (r <= 0) return items[i];
    }
    return items[items.length - 1];
  }

  function refreshCandidates() {
    var pool = poolForMeal(state.meal);
    var used = [], out = [], guard = 0;
    while (out.length < 8 && guard++ < 300) {
      var d = pick(pool, used);
      if (!d) break;
      used.push(d.id); out.push(d);
      if (pool.length <= out.length) break;
    }
    state.candidates = out;
    state.wheelRot = 0;
  }

  function recordsOn(date) {
    return records.filter(function (r) { return r.date === date; });
  }
  function dayKcal(date) {
    return recordsOn(date).reduce(function (s, r) { return s + r.kcal; }, 0);
  }
  function activeMeals() {
    return MEALS.filter(function (m) { return m.id !== 'm' || settings.midnight; });
  }

  /* ---------- 渲染 ---------- */
  function viewHTML() {
    if (state.view === 'draw') return drawHTML();
    if (state.view === 'calendar') return calendarHTML();
    if (state.view === 'stats') return statsHTML();
    return settingsHTML();
  }

  function shellHTML() {
    var navs = [
      { id: 'draw', ico: '🎯', lab: '抽签' },
      { id: 'calendar', ico: '📅', lab: '日历' },
      { id: 'stats', ico: '📊', lab: '统计' },
      { id: 'settings', ico: '⚙️', lab: '设置' }
    ];
    var rail = navs.map(function (n) {
      return '<button class="rail-item' + cls(state.view === n.id) + '" data-act="nav" data-v="' + n.id + '">' +
        '<span class="ico">' + n.ico + '</span><span class="lab">' + n.lab + '</span></button>';
    }).join('');
    var tabs = navs.map(function (n) {
      return '<button class="' + (state.view === n.id ? 'on' : '') + '" data-act="nav" data-v="' + n.id + '">' +
        '<span class="ico">' + n.ico + '</span><span>' + n.lab + '</span></button>';
    }).join('');

    return '<div class="rail"><div class="rail-brand">今天吃什么</div>' + rail + '</div>' +
      '<div class="main"><div class="wrap">' +
      '<div class="topbar"><h1>' + titleOf(state.view) + '</h1><div class="sub">' + subOf(state.view) + '</div></div>' +
      viewHTML() +
      '</div></div>' +
      '<div class="tabbar">' + tabs + '</div>';
  }

  function titleOf(v) {
    return { draw: '今天吃什么', calendar: '三餐记录', stats: '本月统计', settings: '设置' }[v];
  }
  function subOf(v) {
    var d = parseYmd(today());
    var base = d.getFullYear() + ' 年 ' + (d.getMonth() + 1) + ' 月 ' + d.getDate() + ' 日';
    if (v === 'draw') return base + ' · 选一道菜';
    if (v === 'calendar') return base + ' · 点日期看三餐';
    if (v === 'stats') return state.month.replace('-', ' 年 ') + ' 月';
    return '数据与偏好';
  }

  /* 抽签页 */
  function drawHTML() {
    var meals = activeMeals().map(function (m) {
      return '<button class="' + (state.meal === m.id ? 'on' : '') + '" data-act="meal" data-m="' + m.id + '">' + m.name + '</button>';
    }).join('');

    var chips = '<button class="chip' + cls(state.filterCuisines.length === 0) + '" data-act="cuisine" data-c="">全部</button>' +
      CUISINES.map(function (c) {
        var on = state.filterCuisines.indexOf(c.id) >= 0;
        return '<button class="chip' + cls(on) + '" data-act="cuisine" data-c="' + c.id + '">' + c.name + '</button>';
      }).join('');

    var fs = [];
    if (state.filterCuisines.length) fs.push(state.filterCuisines.map(cuisineName).join('、'));
    if (state.filterTags.length) fs.push(state.filterTags.map(function (t) {
      for (var i = 0; i < TAG_META.length; i++) if (TAG_META[i].id === t) return TAG_META[i].name;
      return t;
    }).join('、'));
    if (settings.avoid.length) fs.push('忌口 ' + settings.avoid.length + ' 项');
    var fsText = fs.length ? '当前：' + fs.join(' · ') : '当前：全部菜库 · 惊喜模式';

    var stage = settings.mode === 'wheel'
      ? '<div class="wheel-stage"><canvas id="wheel" width="640" height="640"></canvas><div class="pin"></div></div>'
      : '<div class="lots">' + state.candidates.map(function (d, i) {
        return '<div class="lot' + (state.result && state.result.id === d.id ? ' win' : '') + '" data-i="' + i + '">🎴</div>';
      }).join('') + '</div>';

    var resultHTML = '';
    if (state.result) {
      var d = state.result;
      resultHTML = '<div class="result">' +
        '<div class="rname">' + d.icon + ' ' + d.name + ' <span class="tagline">' + cuisineName(d.cuisines[0]) + '</span></div>' +
        '<div class="rmeta">食材：' + d.ingredients + '</div>' +
        '<div class="ring">约 ' + d.kcal + ' kcal / 份（估算值）</div>' +
        '<div class="acts">' +
        '<button class="btn btn-primary" data-act="accept">就吃这个</button>' +
        '<button class="btn" data-act="again">换一个</button>' +
        '<button class="btn" data-act="other">记入其他餐次</button>' +
        '<button class="btn btn-sm" data-act="fav" data-id="' + d.id + '">' + (favorites.indexOf(d.id) >= 0 ? '已收藏' : '收藏') + '</button>' +
        '</div></div>';
    }

    var todayCard = dayCardHTML(today(), true);

    return '<div class="split"><div>' +
      '<div class="card"><div class="meals">' + meals + '</div>' +
      '<div class="hint" style="text-align:left;margin-top:8px">按当前时间自动选中，可手动切换；菜库按餐次过滤</div></div>' +
      '<div class="card"><div class="card-t">菜系 <span class="more">' +
      '<button class="btn btn-sm btn-ghost" data-act="clear-filters">清除筛选</button></span></div>' +
      '<div class="chips">' + chips + '</div>' +
      '<div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">' +
      '<button class="btn btn-sm" data-act="open-filters">更多筛选</button>' +
      '<button class="btn btn-sm' + cls(settings.mode === 'wheel') + '" data-act="mode" data-v="wheel">转盘</button>' +
      '<button class="btn btn-sm' + cls(settings.mode === 'lots') + '" data-act="mode" data-v="lots">抽签桶</button>' +
      '</div>' +
      '<div class="hint" style="text-align:left;margin-top:10px">' + fsText + '</div></div>' +
      '<div class="card"><div class="wheel-box">' + stage +
      '<button class="btn btn-primary btn-lg btn-block" data-act="spin">今天吃什么</button>' +
      '<div class="hint">' + (state.candidates.length ? '候选 ' + state.candidates.length + ' 道' : '当前筛选下没有可抽的菜，试试放宽条件') + '</div>' +
      '</div></div>' +
      resultHTML +
      '</div><div>' + todayCard + '</div></div>';
  }

  function dayCardHTML(date, compact) {
    var rs = recordsOn(date);
    var d = parseYmd(date);
    var groups = activeMeals().map(function (m) {
      var list = rs.filter(function (r) { return r.meal === m.id; });
      var sum = list.reduce(function (s, r) { return s + r.kcal; }, 0);
      var rows = list.length ? list.map(function (r) {
        return '<div class="item"><span class="ico">' + r.icon + '</span>' +
          '<div class="body"><div class="t1">' + r.dishName + '</div>' +
          '<div class="t2">' + cuisineName(r.cuisine) + ' · ' + r.servings + ' 份</div></div>' +
          '<span class="kcal">' + r.kcal + ' kcal</span>' +
          (compact ? '' : '<button class="del" data-act="del" data-id="' + r.id + '">×</button>') + '</div>';
      }).join('') : '<div class="empty">未记录</div>';
      var acts = compact ? '' :
        '<div style="display:flex;gap:8px;margin-top:6px">' +
        '<button class="btn btn-sm" data-act="add" data-meal="' + m.id + '" data-date="' + date + '">+ 补录</button>' +
        '<button class="btn btn-sm" data-act="drawfor" data-meal="' + m.id + '" data-date="' + date + '">抽一抽</button></div>';
      return '<div class="meal-group"><div class="meal-head"><span class="n">' + m.name + '</span>' +
        '<span>' + (list.length ? sum + ' kcal' : '') + '</span></div>' + rows + acts + '</div>';
    }).join('');

    var total = dayKcal(date);
    var head = (d.getMonth() + 1) + '月' + d.getDate() + '日 周' + DAY[(d.getDay() + 6) % 7];
    var goal = settings.goalOn
      ? '<div class="bar-row"><span class="nm">热量</span><span class="bar-track"><span class="bar-fill" style="width:' +
        Math.min(100, Math.round(total / settings.goal * 100)) + '%"></span></span><span class="vl">' + total + '/' + settings.goal + '</span></div>'
      : '<div class="hint" style="text-align:left">当日合计 ' + total + ' kcal（估算）</div>';

    return '<div class="card"><div class="card-t">' + head + (compact ? ' <span class="more">今日</span>' : '') + '</div>' +
      goal + '<div style="margin-top:10px">' + groups + '</div></div>';
  }

  /* 日历页 */
  function monthCells(ym) {
    var p = ym.split('-');
    var y = +p[0], m = +p[1];
    var first = new Date(y, m - 1, 1);
    var lead = (first.getDay() + 6) % 7;
    var dim = new Date(y, m, 0).getDate();
    var cells = [], i;
    for (i = 0; i < lead; i++) cells.push(null);
    for (i = 1; i <= dim; i++) cells.push(ymd(new Date(y, m - 1, i)));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }

  function calendarHTML() {
    var cells = monthCells(state.month);
    var p = state.month.split('-');
    var grid = cells.map(function (date) {
      if (!date) return '<div></div>';
      var rs = recordsOn(date);
      var dots = activeMeals().map(function (m) {
        var on = rs.some(function (r) { return r.meal === m.id; });
        return '<span class="dot' + cls(on) + '"></span>';
      }).join('');
      var kc = rs.length ? dayKcal(date) : '';
      return '<button class="cal-cell' + cls(date === state.selDate) + (date === today() ? ' today' : '') +
        '" data-act="sel-day" data-d="' + date + '"><span class="d">' + (+date.slice(8)) + '</span>' +
        '<span class="dots">' + dots + '</span>' +
        '<span class="kc">' + kc + '</span></button>';
    }).join('');

    var stats = monthStat(state.month);
    var top = stats.cuisines.slice(0, 5).map(function (c) {
      return '<div class="bar-row"><span class="nm">' + cuisineName(c.id) + '</span>' +
        '<span class="bar-track"><span class="bar-fill" style="width:' + Math.round(c.n / stats.cuisines[0].n * 100) + '%"></span></span>' +
        '<span class="vl">' + c.n + ' 次</span></div>';
    }).join('');

    return '<div class="split-cal"><div>' +
      '<div class="card"><div class="cal-head">' +
      '<div class="m">' + p[0] + ' 年 ' + (+p[1]) + ' 月</div>' +
      '<div class="cal-nav">' +
      '<button data-act="prev-month">‹</button>' +
      '<button data-act="this-month">今天</button>' +
      '<button data-act="next-month">›</button></div></div>' +
      '<div class="cal-grid">' + DAY.map(function (d) { return '<div class="cal-dow">' + d + '</div>'; }).join('') + grid + '</div>' +
      '<div class="hint" style="text-align:left;margin-top:10px">格子内三个点依次代表早 / 午 / 晚' + (settings.midnight ? ' / 夜宵' : '') + '，实心为已记录</div>' +
      '</div>' +
      '<div class="card"><div class="card-t">本月概览</div>' +
      '<div class="stat-row">' +
      '<div class="stat"><div class="v">' + stats.days + '</div><div class="l">已记录天数</div></div>' +
      '<div class="stat"><div class="v">' + stats.avg + '</div><div class="l">日均 kcal</div></div>' +
      '<div class="stat"><div class="v">' + stats.cover + '%</div><div class="l">三餐覆盖率</div></div>' +
      '<div class="stat"><div class="v">' + stats.streak + '</div><div class="l">连续天数</div></div>' +
      '</div><div style="margin-top:14px">' + (stats.cuisines.length ? top : '<div class="empty">本月还没有记录</div>') + '</div>' +
      '</div></div><div>' + dayCardHTML(state.selDate, false) + '</div></div>';
  }

  function monthStat(ym) {
    var rs = records.filter(function (r) { return r.date.slice(0, 7) === ym; });
    var byDate = {};
    rs.forEach(function (r) { byDate[r.date] = (byDate[r.date] || 0) + r.kcal; });
    var dates = Object.keys(byDate);
    var total = dates.reduce(function (s, k) { return s + byDate[k]; }, 0);
    var counts = {};
    rs.forEach(function (r) { counts[r.cuisine] = (counts[r.cuisine] || 0) + 1; });
    var cuisines = Object.keys(counts).map(function (k) { return { id: k, n: counts[k] }; })
      .sort(function (a, b) { return b.n - a.n; });
    var mealCount = 0, slots = 0;
    var dim = new Date(+ym.slice(0, 4), +ym.slice(5, 7), 0).getDate();
    var dayList = {};
    rs.forEach(function (r) { dayList[r.date] = dayList[r.date] || {}; dayList[r.date][r.meal] = 1; });
    Object.keys(dayList).forEach(function (k) { mealCount += Object.keys(dayList[k]).length; });
    slots = Object.keys(dayList).length * activeMeals().length;
    var streak = 0, cur = today();
    while (recordsOn(cur).length) { streak++; cur = ymd(new Date(parseYmd(cur).getTime() - 86400000)); }
    return {
      days: dates.length,
      avg: dates.length ? Math.round(total / dates.length) : 0,
      total: total,
      cover: slots ? Math.round(mealCount / slots * 100) : 0,
      streak: streak,
      cuisines: cuisines,
      dim: dim
    };
  }

  /* 统计页 */
  function statsHTML() {
    var st = monthStat(state.month);
    var rs = records.filter(function (r) { return r.date.slice(0, 7) === state.month; });
    var dishCount = {};
    rs.forEach(function (r) { dishCount[r.dishName] = (dishCount[r.dishName] || 0) + 1; });
    var topDishes = Object.keys(dishCount).map(function (k) { return { n: k, c: dishCount[k] }; })
      .sort(function (a, b) { return b.c - a.c; }).slice(0, 5);

    var mealBars = activeMeals().map(function (m) {
      var n = rs.filter(function (r) { return r.meal === m.id; }).length;
      return '<div class="bar-row"><span class="nm">' + m.name + '</span>' +
        '<span class="bar-track"><span class="bar-fill" style="width:' + Math.round(n / st.dim * 100) + '%"></span></span>' +
        '<span class="vl">' + n + ' 次</span></div>';
    }).join('');

    var max = 1;
    var daily = [];
    for (var i = 1; i <= st.dim; i++) {
      var date = state.month + '-' + pad(i);
      var v = dayKcal(date);
      daily.push(v);
      if (v > max) max = v;
    }
    var spark = '<div class="spark">' + daily.map(function (v) {
      return '<span class="' + (v ? '' : 'zero') + '" style="height:' + (v ? Math.max(4, Math.round(v / max * 100)) : 3) + '%" title="' + v + ' kcal"></span>';
    }).join('') + '</div>';

    var topHTML = topDishes.length ? topDishes.map(function (d) {
      return '<div class="item"><div class="body"><div class="t1">' + d.n + '</div></div><span class="kcal">' + d.c + ' 次</span></div>';
    }).join('') : '<div class="empty">暂无数据</div>';

    return '<div class="card"><div class="card-t">本月菜系分布</div>' +
      (st.cuisines.length ? st.cuisines.map(function (c) {
        return '<div class="bar-row"><span class="nm">' + cuisineName(c.id) + '</span>' +
          '<span class="bar-track"><span class="bar-fill" style="width:' + Math.round(c.n / st.cuisines[0].n * 100) + '%"></span></span>' +
          '<span class="vl">' + c.n + ' 次</span></div>';
      }).join('') : '<div class="empty">本月还没有记录</div>') + '</div>' +
      '<div class="card"><div class="card-t">三餐覆盖</div>' + mealBars + '</div>' +
      '<div class="card"><div class="card-t">每日热量趋势 <span class="more">日均 ' + st.avg + ' kcal</span></div>' +
      spark + '<div class="goal-line">横轴为本月 1–' + st.dim + ' 日，未记录的日期不显示柱体（估算值，仅供参考）</div></div>' +
      '<div class="card"><div class="card-t">本月吃得最多</div>' + topHTML + '</div>';
  }

  /* 设置页 */
  function settingsHTML() {
    var avoidChips = AVOID_META.map(function (a) {
      var on = settings.avoid.indexOf(a.id) >= 0;
      return '<button class="chip' + cls(on) + '" data-act="avoid" data-a="' + a.id + '">' + a.name + '</button>';
    }).join('');

    return '<div class="card"><div class="card-t">外观</div>' +
      '<div class="field"><div class="k">主题</div><div class="v"><select data-act="set-theme">' +
      ['dark|深色', 'light|浅色', 'auto|跟随系统'].map(function (o) {
        var p = o.split('|');
        return '<option value="' + p[0] + '"' + (settings.theme === p[0] ? ' selected' : '') + '>' + p[1] + '</option>';
      }).join('') + '</select></div></div></div>' +

      '<div class="card"><div class="card-t">抽签偏好</div>' +
      '<div class="field"><div class="k">显示夜宵<small>关闭后餐次与日历不再出现夜宵</small></div>' +
      '<button class="sw' + cls(settings.midnight) + '" data-act="toggle" data-k="midnight"></button></div>' +
      '<div class="field"><div class="k">智能去重<small>7 天内吃过的菜降权</small></div>' +
      '<button class="sw' + cls(settings.dedupe) + '" data-act="toggle" data-k="dedupe"></button></div>' +
      '<div class="field"><div class="k">默认份量</div><div class="v"><select data-act="set-serving">' +
      [0.5, 1, 1.5, 2].map(function (s) {
        return '<option value="' + s + '"' + (+settings.serving === s ? ' selected' : '') + '>' + s + ' 份</option>';
      }).join('') + '</select></div></div>' +
      '<div class="field"><div class="k">忌口过滤<small>命中的菜不会出现在候选里</small></div><div class="v">' + settings.avoid.length + ' 项</div></div>' +
      '<div class="chips wrap" style="margin-top:8px">' + avoidChips + '</div></div>' +

      '<div class="card"><div class="card-t">热量目标</div>' +
      '<div class="field"><div class="k">启用每日目标<small>在日历与统计中显示进度</small></div>' +
      '<button class="sw' + cls(settings.goalOn) + '" data-act="toggle" data-k="goalOn"></button></div>' +
      (settings.goalOn ? '<div class="field"><div class="k">目标 kcal</div><div class="v"><input type="number" data-act="set-goal" value="' + settings.goal + '" style="width:96px"></div></div>' : '') +
      '<p class="note">热量为基于常见食物成分表的估算值，受食材分量与烹饪方式影响较大，仅供参考，不构成营养或医学建议。</p></div>' +

      '<div class="card"><div class="card-t">数据</div>' +
      '<div class="field"><div class="k">记录条数</div><div class="v">' + records.length + ' 条</div></div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">' +
      '<button class="btn" data-act="export">导出备份</button>' +
      '<button class="btn" data-act="import">导入备份</button>' +
      '<button class="btn" data-act="reseed">重置示例数据</button>' +
      '<button class="btn" data-act="clear">清空记录</button>' +
      '</div><p class="note" style="margin-top:10px">数据只保存在本设备浏览器中，清理浏览器数据会丢失，建议定期导出备份。</p></div>';
  }

  /* 筛选面板 */
  function filterSheetHTML() {
    var tags = TAG_META.map(function (t) {
      var on = state.filterTags.indexOf(t.id) >= 0;
      return '<button class="chip' + cls(on) + '" data-act="tag" data-t="' + t.id + '">' + t.name + '</button>';
    }).join('');
    var avoids = AVOID_META.map(function (a) {
      var on = settings.avoid.indexOf(a.id) >= 0;
      return '<button class="chip' + cls(on) + '" data-act="avoid" data-a="' + a.id + '">' + a.name + '</button>';
    }).join('');
    var cuis = CUISINES.map(function (c) {
      var on = state.filterCuisines.indexOf(c.id) >= 0;
      return '<button class="chip' + cls(on) + '" data-act="cuisine" data-c="' + c.id + '">' + c.name + '</button>';
    }).join('');

    return '<div class="sheet-mask" data-act="close-sheet"><div class="sheet" data-stop="1">' +
      '<div class="sheet-head"><h3>筛选条件</h3><button class="btn btn-sm btn-ghost" data-act="close-sheet">完成</button></div>' +
      '<div class="sheet-sec"><div class="lb">菜系（可多选，不选为全部）</div><div class="chips wrap">' + cuis + '</div></div>' +
      '<div class="sheet-sec"><div class="lb">口味与场景</div><div class="chips wrap">' + tags + '</div></div>' +
      '<div class="sheet-sec"><div class="lb">忌口（长期生效，写入设置）</div><div class="chips wrap">' + avoids + '</div></div>' +
      '<div style="display:flex;gap:8px"><button class="btn btn-block" data-act="clear-filters">重置筛选</button>' +
      '<button class="btn btn-primary btn-block" data-act="close-sheet">应用</button></div>' +
      '</div></div>';
  }

  function pickSheetHTML(date, meal) {
    var q = state.pickQuery || '';
    var hits = DISHES.filter(function (d) {
      return d.meals.indexOf(meal) >= 0 && (!q || d.haystack.indexOf(q) >= 0);
    }).slice(0, 60);
    return '<div class="sheet-mask" data-act="close-sheet"><div class="sheet" data-stop="1">' +
      '<div class="sheet-head"><h3>补录 · ' + mealName(meal) + '</h3><button class="btn btn-sm btn-ghost" data-act="close-sheet">关闭</button></div>' +
      '<input class="search" placeholder="搜索菜名或食材" value="' + q + '" data-act="pick-query">' +
      '<div class="dish-list">' + hits.map(function (d) {
        return '<button class="dish-hit" data-act="pick-add" data-id="' + d.id + '" data-meal="' + meal + '" data-date="' + date + '">' +
          '<span class="ico">' + d.icon + '</span><span class="nm">' + d.name + ' <span class="t2">' + cuisineName(d.cuisines[0]) + '</span></span>' +
          '<span class="kk">' + d.kcal + ' kcal</span></button>';
      }).join('') + '</div></div></div>';
  }

  /* ---------- 转盘 ---------- */
  var WHEEL_COLORS = ['#E8833A', '#C96A2B', '#F0A05E', '#B85C25', '#D97B3E', '#A9541F', '#EFB182', '#8F4718'];

  function drawWheel() {
    var c = document.getElementById('wheel');
    if (!c) return;
    var ctx = c.getContext('2d');
    var w = c.width, h = c.height, cx = w / 2, cy = h / 2, r = w / 2 - 10;
    var items = state.candidates;
    ctx.clearRect(0, 0, w, h);
    if (!items.length) return;
    var n = items.length, step = 2 * Math.PI / n;
    items.forEach(function (it, i) {
      var a0 = -Math.PI / 2 + state.wheelRot + i * step;
      var a1 = a0 + step;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, a0, a1);
      ctx.closePath();
      ctx.fillStyle = WHEEL_COLORS[i % WHEEL_COLORS.length];
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.28)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(a0 + step / 2);
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fff';
      ctx.font = '500 26px system-ui, "PingFang SC", sans-serif';
      var nm = it.name.length > 7 ? it.name.slice(0, 7) : it.name;
      ctx.fillText(nm, r - 26, 0);
      ctx.restore();
    });
    ctx.beginPath();
    ctx.arc(cx, cy, 54, 0, 2 * Math.PI);
    ctx.fillStyle = '#1E2228';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.14)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#E6E8EB';
    ctx.font = '600 26px system-ui, "PingFang SC", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('开抽', cx, cy);
  }

  function spin() {
    if (state.spinning || !state.candidates.length) return;
    state.spinning = true;

    if (settings.mode === 'lots') {
      var lots = document.querySelectorAll('.lot');
      for (var i = 0; i < lots.length; i++) lots[i].classList.add('shake');
      var idx = Math.floor(Math.random() * state.candidates.length);
      setTimeout(function () {
        for (var j = 0; j < lots.length; j++) lots[j].classList.remove('shake');
        if (lots[idx]) lots[idx].classList.add('win');
        setTimeout(function () {
          state.result = state.candidates[idx];
          state.spinning = false;
          render();
        }, 520);
      }, 900);
      return;
    }

    var n = state.candidates.length;
    var step = 2 * Math.PI / n;
    var idx2 = Math.floor(Math.random() * n);
    var desired = -(idx2 * step + step / 2);
    var cur = state.wheelRot;
    var delta = ((desired - cur) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
    var target = cur + 10 * Math.PI + delta;
    var t0 = performance.now(), dur = 2800;

    function frame(now) {
      var p = Math.min(1, (now - t0) / dur);
      var e = 1 - Math.pow(1 - p, 3);
      state.wheelRot = cur + (target - cur) * e;
      drawWheel();
      if (p < 1) { requestAnimationFrame(frame); return; }
      state.result = state.candidates[idx2];
      state.spinning = false;
      render();
    }
    requestAnimationFrame(frame);
  }

  /* ---------- 动作 ---------- */
  function addRecord(dish, date, meal, source) {
    var s = +settings.serving || 1;
    records.push({
      id: 'r' + Date.now() + Math.floor(Math.random() * 1000),
      date: date, meal: meal,
      dishId: dish.id, dishName: dish.name, icon: dish.icon,
      cuisine: dish.cuisines[0],
      servings: s,
      kcal: Math.round(dish.kcal * s),
      source: source || 'draw',
      createdAt: new Date().toISOString()
    });
    save('records', records);
  }

  function toast(msg) {
    var el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(function () { el.remove(); }, 1800);
  }

  function applyTheme() {
    var t = settings.theme;
    if (t === 'auto') t = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', t);
  }

  function render() {
    var app = document.getElementById('app');
    app.innerHTML = shellHTML();
    var sheetHost = document.getElementById('sheet-host');
    if (state.sheet === 'filters') sheetHost.innerHTML = filterSheetHTML();
    else if (state.sheet === 'pick') sheetHost.innerHTML = pickSheetHTML(state.pickDate, state.pickMeal);
    else sheetHost.innerHTML = '';
    drawWheel();
    applyTheme();
  }

  function onClick(e) {
    var el = e.target.closest('[data-act]');
    if (!el) return;
    var act = el.getAttribute('data-act');
    var v = el.getAttribute('data-v');
    var d;

    if (act === 'nav') { state.view = v; state.result = null; if (v === 'draw') ensureCandidates(); render(); return; }
    if (act === 'meal') { state.meal = v; state.result = null; state.shownIds = []; refreshCandidates(); render(); return; }
    if (act === 'cuisine') {
      var c = el.getAttribute('data-c');
      if (!c) state.filterCuisines = [];
      else {
        var i = state.filterCuisines.indexOf(c);
        if (i >= 0) state.filterCuisines.splice(i, 1); else state.filterCuisines.push(c);
      }
      state.result = null; state.shownIds = []; refreshCandidates(); render(); return;
    }
    if (act === 'tag') {
      var t = el.getAttribute('data-t');
      var ti = state.filterTags.indexOf(t);
      if (ti >= 0) state.filterTags.splice(ti, 1); else state.filterTags.push(t);
      state.result = null; state.shownIds = []; refreshCandidates(); render(); return;
    }
    if (act === 'avoid') {
      var a = el.getAttribute('data-a');
      var ai = settings.avoid.indexOf(a);
      if (ai >= 0) settings.avoid.splice(ai, 1); else settings.avoid.push(a);
      save('settings', settings);
      state.result = null; refreshCandidates(); render(); return;
    }
    if (act === 'clear-filters') { state.filterCuisines = []; state.filterTags = []; state.result = null; refreshCandidates(); render(); return; }
    if (act === 'mode') { settings.mode = v; save('settings', settings); state.result = null; render(); return; }
    if (act === 'open-filters') { state.sheet = 'filters'; render(); return; }
    if (act === 'close-sheet') { if (e.target.closest('[data-stop]') && !el.hasAttribute('data-v')) { if (el.textContent === '完成' || el.textContent === '应用' || el.textContent === '关闭') { state.sheet = null; render(); } return; } state.sheet = null; render(); return; }
    if (act === 'spin') { ensureCandidates(); state.result = null; spin(); return; }
    if (act === 'again') {
      if (!state.candidates.length) return;
      state.shownIds.push(state.result.id);
      var nd = pick(state.candidates, state.shownIds) || pick(state.candidates, []);
      state.result = nd; render(); return;
    }
    if (act === 'accept') {
      addRecord(state.result, today(), state.meal, 'draw');
      toast('已记入 ' + (+today().slice(5, 7)) + '月' + (+today().slice(8)) + '日 ' + mealName(state.meal));
      state.result = null; state.shownIds = []; refreshCandidates(); render(); return;
    }
    if (act === 'other') {
      state.sheet = 'pick'; state.pickDate = today(); state.pickMeal = state.meal; state.pickQuery = '';
      state.pendingDish = state.result; render(); return;
    }
    if (act === 'fav') {
      var id = el.getAttribute('data-id');
      var fi = favorites.indexOf(id);
      if (fi >= 0) favorites.splice(fi, 1); else favorites.push(id);
      save('favorites', favorites); render(); return;
    }
    if (act === 'sel-day') { state.selDate = el.getAttribute('data-d'); render(); return; }
    if (act === 'prev-month' || act === 'next-month') {
      var pp = state.month.split('-');
      var dt = new Date(+pp[0], +pp[1] - 1 + (act === 'next-month' ? 1 : -1), 1);
      state.month = dt.getFullYear() + '-' + pad(dt.getMonth() + 1);
      render(); return;
    }
    if (act === 'this-month') { state.month = today().slice(0, 7); state.selDate = today(); render(); return; }
    if (act === 'add') { state.sheet = 'pick'; state.pickDate = el.getAttribute('data-date'); state.pickMeal = el.getAttribute('data-meal'); state.pickQuery = ''; render(); return; }
    if (act === 'drawfor') {
      var date2 = el.getAttribute('data-date'), meal2 = el.getAttribute('data-meal');
      var pool = poolForMeal(meal2);
      d = pick(pool, []);
      if (!d) { toast('当前筛选下没有可抽的菜'); return; }
      addRecord(d, date2, meal2, 'draw');
      toast('已为 ' + mealName(meal2) + ' 记入 ' + d.name);
      render(); return;
    }
    if (act === 'pick-add') {
      var did = el.getAttribute('data-id');
      d = null;
      for (var k = 0; k < DISHES.length; k++) if (DISHES[k].id === did) d = DISHES[k];
      if (!d) return;
      addRecord(d, el.getAttribute('data-date'), el.getAttribute('data-meal'), 'manual');
      state.sheet = null; render(); return;
    }
    if (act === 'del') {
      var rid = el.getAttribute('data-id');
      records = records.filter(function (r) { return r.id !== rid; });
      save('records', records); render(); return;
    }
    if (act === 'toggle') {
      var key = el.getAttribute('data-k');
      settings[key] = !settings[key];
      if (key === 'midnight' && !settings.midnight && state.meal === 'm') state.meal = 'd';
      save('settings', settings); refreshCandidates(); render(); return;
    }
    if (act === 'export') {
      var blob = new Blob([JSON.stringify({ records: records, settings: settings, favorites: favorites }, null, 2)], { type: 'application/json' });
      var a2 = document.createElement('a');
      a2.href = URL.createObjectURL(blob);
      a2.download = 'what-to-eat-备份.json';
      a2.click();
      toast('已导出备份文件'); return;
    }
    if (act === 'import') {
      var inp = document.createElement('input');
      inp.type = 'file'; inp.accept = 'application/json';
      inp.onchange = function () {
        var f = inp.files[0]; if (!f) return;
        var fr = new FileReader();
        fr.onload = function () {
          try {
            var o = JSON.parse(fr.result);
            if (o.records) records = o.records;
            if (o.settings) settings = Object.assign({}, DEFAULT_SETTINGS, o.settings);
            if (o.favorites) favorites = o.favorites;
            save('records', records); save('settings', settings); save('favorites', favorites);
            toast('导入成功'); render();
          } catch (err) { toast('文件格式不正确'); }
        };
        fr.readAsText(f);
      };
      inp.click(); return;
    }
    if (act === 'reseed') { records = seedRecords(); save('records', records); toast('已重置示例数据'); render(); return; }
    if (act === 'clear') {
      if (!window.confirm('确定清空全部用餐记录？此操作不可恢复，建议先导出备份。')) return;
      records = []; save('records', records); toast('记录已清空'); render(); return;
    }
  }

  function onInput(e) {
    var el = e.target.closest('[data-act]');
    if (!el) return;
    var act = el.getAttribute('data-act');
    if (act === 'pick-query') {
      state.pickQuery = el.value;
      var host = document.getElementById('sheet-host');
      var val = el.value;
      host.innerHTML = pickSheetHTML(state.pickDate, state.pickMeal);
      var inp = host.querySelector('input');
      if (inp) { inp.value = val; inp.focus(); }
      return;
    }
    if (act === 'set-theme') { settings.theme = el.value; save('settings', settings); applyTheme(); return; }
    if (act === 'set-serving') { settings.serving = +el.value; save('settings', settings); return; }
    if (act === 'set-goal') { settings.goal = +el.value || 1800; save('settings', settings); return; }
  }

  function ensureCandidates() {
    if (!state.candidates.length) refreshCandidates();
  }

  /* ---------- 启动 ---------- */
  document.addEventListener('click', onClick);
  document.addEventListener('input', onInput);
  document.addEventListener('change', onInput);

  refreshCandidates();
  render();
  window.addEventListener('resize', function () { drawWheel(); });
})();
