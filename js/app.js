import {
  loadIncomes,
  loadCategories,
  loadTransactions,
  createIncome,
  updateIncome,
  deleteIncome,
  createCategory,
  updateCategory,
  deleteCategory,
  createTransaction,
  updateTransaction,
  deleteTransaction
} from './database.js';

import {
  getCurrentSession,
  signInWithPassword,
  signOut,
  observeAuthChanges
} from './auth.js';

(function(){
    const loginView =
    document.getElementById('loginView');

  const appView =
    document.getElementById('app');

  const loginForm =
    document.getElementById('loginForm');

  const loginEmail =
    document.getElementById('loginEmail');

  const loginPassword =
    document.getElementById('loginPassword');

  const loginButton =
    document.getElementById('loginButton');

  const loginError =
    document.getElementById('loginError');

  const logoutButton =
    document.getElementById('logoutButton');

  let applicationLoaded = false;
  let applicationLoadPromise = null;

  function showLogin() {
    loginView.hidden = false;
    appView.hidden = true;
  }

  function showApplication() {
    loginView.hidden = true;
    appView.hidden = false;
  }
  const MONTH_STORAGE_KEY = 'clemence-budget-current-month';
  const MONTH_NAMES = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];

  function eur(n){
    n = Number(n)||0;
    return n.toLocaleString('fr-FR',{style:'currency',currency:'EUR', maximumFractionDigits:2});
  }
  function todayISO(){
    const d = new Date();
    return d.toISOString().slice(0,10);
  }

  function defaultData() {
  const now = new Date();

  return {
    currentMonth:
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
    income: [],
    categories: [],
    transactions: [],
    billsPaid: {},
    seededReal: true
  };
}

  function mapIncome(row) {
    return {
      id: row.id,
      name: row.name,
      amount: Number(row.amount)
    };
  }

  function mapCategory(row) {
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      type: row.type,
      budget: Number(row.budget),
      isBill: Boolean(row.is_bill),
      dueDay: row.due_day
    };
  }

  function mapTransaction(row) {
    return {
      id: row.id,
      date: row.transaction_date,
      month: row.budget_month.slice(0, 7),
      amount: Number(row.amount),
      categoryId: row.category_id,
      vendor: row.vendor || '',
      notes: row.notes || ''
    };
  }

  let data = null;

  async function load() {
    const initialData = defaultData();
    const storedMonth = localStorage.getItem(MONTH_STORAGE_KEY);

    data = {
      ...initialData,
      currentMonth: storedMonth || initialData.currentMonth
    };

    const [incomes, categories, transactions] = await Promise.all([
      loadIncomes(),
      loadCategories(),
      loadTransactions(data.currentMonth)
    ]);

    data.income = incomes.map(mapIncome);
    data.categories = categories.map(mapCategory);
    data.transactions = transactions.map(mapTransaction);

    render();
  }

  async function reloadCurrentMonth() {
    const transactions = await loadTransactions(data.currentMonth);
    data.transactions = transactions.map(mapTransaction);

    localStorage.setItem(
      MONTH_STORAGE_KEY,
      data.currentMonth
    );

    render();
  }

  // ---------- helpers de mois ----------
  function monthLabel(m){
    const [y,mo] = m.split('-').map(Number);
    return MONTH_NAMES[mo-1] + ' ' + y;
  }
  function shiftMonth(m, delta){
    let [y,mo] = m.split('-').map(Number);
    mo += delta;
    if(mo<1){mo=12;y--;} if(mo>12){mo=1;y++;}
    return y+'-'+String(mo).padStart(2,'0');
  }
  function txInMonth(){
    return data.transactions.filter(t => (t.month || t.date.slice(0,7)) === data.currentMonth);
  }
  function catById(id){ return data.categories.find(c=>c.id===id); }
  function spentByCategory(catId){
    return txInMonth().filter(t=>t.categoryId===catId).reduce((s,t)=>s+Number(t.amount),0);
  }
  function totalIncome(){
    return data.income.reduce((s,i)=>s+Number(i.amount),0);
  }
  function totalsByType(){
    const res = {oblig:{budget:0,actual:0}, besoins:{budget:0,actual:0}, envies:{budget:0,actual:0}};
    data.categories.forEach(c=>{
      if(!res[c.type]) return;
      res[c.type].budget += Number(c.budget)||0;
      res[c.type].actual += spentByCategory(c.id);
    });
    return res;
  }

  // ---------- rendu ----------
  function render(){
    document.getElementById('monthLabel').textContent = monthLabel(data.currentMonth);
    renderResume();
    renderTx();
    renderBudget();
  }

  function renderResume(){
    const totals = totalsByType();
    const income = totalIncome();
    const spent = totals.oblig.actual + totals.besoins.actual + totals.envies.actual;
    const left = income - spent;

    document.getElementById('heroLeft').textContent = eur(left);
    document.getElementById('heroSub').textContent = left>=0 ? 'Il te reste ce montant sur ' + monthLabel(data.currentMonth) : 'Dépassement ce mois-ci';
    document.getElementById('heroIncome').textContent = eur(income);
    document.getElementById('heroSpent').textContent = eur(spent);

    const bars = [
      {label:'Fixes', ...totals.oblig, cls:'oblig'},
      {label:'Besoins', ...totals.besoins, cls:'besoins'},
      {label:'Envies', ...totals.envies, cls:'envies'}
    ];
    document.getElementById('repartitionBars').innerHTML = bars.map(b=>{
      const pct = b.budget>0 ? Math.min(100,(b.actual/b.budget)*100) : (b.actual>0?100:0);
      const over = b.actual > b.budget && b.budget>0;
      return `<div class="pbar-row">
        <div class="pbar-top"><span class="pbar-name">${b.label}</span><span class="pbar-figures">${eur(b.actual)} / ${eur(b.budget)}</span></div>
        <div class="pbar-track"><div class="pbar-fill ${over?'over':b.cls}" style="width:${pct}%"></div></div>
      </div>`;
    }).join('');

    const groups = [['oblig','Fixes','oblig'],['besoins','Besoins','besoins'],['envies','Envies','envies']];
    let html = '';
    groups.forEach(([type,label,cls])=>{
      const cats = data.categories.filter(c=>c.type===type);
      if(cats.length===0) return;
      html += `<div class="type-heading"><span class="dot ${cls}"></span><span>${label}</span></div><div class="card">`;
      cats.forEach(c=>{
        const actual = spentByCategory(c.id);
        const pct = c.budget>0 ? Math.min(100,(actual/c.budget)*100) : (actual>0?100:0);
        const over = actual > c.budget && c.budget>0;
        html += `<div class="pbar-row">
          <div class="pbar-top"><span class="pbar-name">${c.name}</span><span class="pbar-figures">${eur(actual)} / ${eur(c.budget)}</span></div>
          <div class="pbar-track"><div class="pbar-fill ${over?'over':cls}" style="width:${pct}%"></div></div>
        </div>`;
      });
      html += `</div>`;
    });
    document.getElementById('categoryBreakdown').innerHTML = html;
  }

  function renderTx(){
    const txs = txInMonth().slice().sort((a,b)=> b.date.localeCompare(a.date) || 0);
    const el = document.getElementById('txList');
    if(txs.length===0){
      el.innerHTML = `<div class="empty"><p class="display">Rien à afficher</p><p>Ajoute ta première dépense avec le bouton +</p></div>`;
      return;
    }
    const byDay = {};
    txs.forEach(t=>{ (byDay[t.date] = byDay[t.date]||[]).push(t); });
    let html='';
    Object.keys(byDay).sort().reverse().forEach(day=>{
      const d = new Date(day+'T00:00:00');
      const dayLabel = d.toLocaleDateString('fr-FR',{weekday:'long', day:'numeric', month:'long'});
      html += `<div class="tx-day">${dayLabel}</div>`;
      byDay[day].forEach(t=>{
        const cat = catById(t.categoryId);
        const cls = cat ? cat.type : 'besoins';
        const neg = Number(t.amount) < 0;
        html += `<div class="tx-item" data-edit-tx="${t.id}">
          <div class="tx-tag dot ${cls}"></div>
          <div class="tx-info">
            <div class="tx-name">${escapeHtml(t.vendor||cat?.name||'—')}</div>
            <div class="tx-cat">${cat?cat.name:'Sans catégorie'}${neg? ' · Remboursement':''}${t.notes? ' · '+escapeHtml(t.notes):''}</div>
          </div>
          <div class="tx-amount ${neg?'neg':''}">${eur(t.amount)}</div>
          <button class="tx-del" data-del-tx="${t.id}">✕</button>
        </div>`;
      });
    });
    el.innerHTML = html;
    el.querySelectorAll('[data-edit-tx]').forEach(item=>{
      item.addEventListener('click', (e)=>{
        if(e.target.closest('[data-del-tx]')) return;
        openTxSheet(item.dataset.editTx);
      });
    });
    el.querySelectorAll('[data-del-tx]').forEach(btn=>{
      btn.addEventListener('click', async (e)=>{
        e.stopPropagation();
        const transactionId = btn.dataset.delTx;
        await deleteTransaction(transactionId);
        data.transactions = data.transactions.filter(t => t.id !== transactionId);
        render();
      });
    });
  }

  function renderBudget(){
    const incEl = document.getElementById('incomeList');
    incEl.innerHTML = data.income.map(i=>`
      <div class="cat-item">
        <div class="cat-left"><div><div class="cat-name">${escapeHtml(i.name)}</div><div class="cat-budget">${eur(i.amount)} / mois</div></div></div>
        <div style="display:flex;gap:6px;">
          <button class="icon-btn" data-edit-income="${i.id}">✎</button>
          <button class="icon-btn" data-del-income="${i.id}">✕</button>
        </div>
      </div>`).join('') || '<p style="color:var(--plum-soft); font-size:13px;">Aucun revenu enregistré.</p>';

    ['oblig','besoins','envies'].forEach(type=>{
      const cats = data.categories.filter(c=>c.type===type);
      const el = document.getElementById('cat'+capitalize(type));
      el.innerHTML = cats.map(c=>{
        const actual = spentByCategory(c.id);
        const dueTxt = c.isBill && c.dueDay ? ` · le ${c.dueDay}` : '';
        return `<div class="cat-item">
          <div class="cat-left"><div><div class="cat-name">${escapeHtml(c.name)}</div><div class="cat-budget">Budget ${eur(c.budget)} · réel ${eur(actual)}${dueTxt}</div></div></div>
          <div style="display:flex;gap:6px;">
            <button class="icon-btn" data-edit-cat="${c.id}">✎</button>
            <button class="icon-btn" data-del-cat="${c.id}">✕</button>
          </div>
        </div>`;
      }).join('') || '<p style="color:var(--plum-soft); font-size:13px;">Aucune catégorie.</p>';
    });

    document.querySelectorAll('[data-del-income]').forEach(button => {
      button.addEventListener('click', async () => {
        const incomeId = button.dataset.delIncome;
        await deleteIncome(incomeId);
        data.income = data.income.filter(income => income.id !== incomeId);
        render();
      });
    });
    document.querySelectorAll('[data-edit-income]').forEach(b=>b.addEventListener('click', ()=>openIncomeSheet(b.dataset.editIncome)));
    document.querySelectorAll('[data-del-cat]').forEach(button => {
      button.addEventListener('click', async () => {
        const categoryId = button.dataset.delCat;
        await deleteCategory(categoryId);
        data.categories = data.categories.filter(category => category.id !== categoryId);
        render();
      });
    });
    document.querySelectorAll('[data-edit-cat]').forEach(b=>b.addEventListener('click', ()=>openCategorySheet(b.dataset.editCat)));
  }

  function capitalize(s){ return s.charAt(0).toUpperCase()+s.slice(1); }
  function escapeHtml(s){ return (s||'').replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

  // ---------- navigation onglets ----------
  document.querySelectorAll('.tab-btn').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
      document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('view-'+btn.dataset.view).classList.add('active');
      document.getElementById('fabAdd').style.display = btn.dataset.view==='resume' ? 'none':'flex';
    });
  });
  document.getElementById('fabAdd').style.display='none';

  document.getElementById('prevMonth').addEventListener('click', async () => {
    data.currentMonth = shiftMonth(data.currentMonth, -1);
    await reloadCurrentMonth();
  });

  document.getElementById('nextMonth').addEventListener('click', async () => {
    data.currentMonth = shiftMonth(data.currentMonth, 1);
    await reloadCurrentMonth();
  });

  document.getElementById('fabAdd').addEventListener('click', ()=>{
    const activeView = document.querySelector('.tab-btn.active').dataset.view;
    if(activeView==='tx') openTxSheet();
    else if(activeView==='budget') openCategorySheet();
  });
  document.getElementById('addIncomeBtn').addEventListener('click', ()=>openIncomeSheet());
  document.getElementById('addCatBtn').addEventListener('click', ()=>openCategorySheet());

  // ---------- sheets / modales ----------
  const overlay = document.getElementById('overlay');
  const sheetContent = document.getElementById('sheetContent');
  function closeSheet(){ overlay.classList.remove('open'); sheetContent.innerHTML=''; }
  overlay.addEventListener('click', (e)=>{ if(e.target===overlay) closeSheet(); });

  function openSheet(html){
    sheetContent.innerHTML = `<button class="close-x" id="closeSheetBtn">✕</button><div class="sheet-handle"></div>` + html;
    overlay.classList.add('open');
    document.getElementById('closeSheetBtn').addEventListener('click', closeSheet);
  }

  function openTxSheet(editId){
    const existing = editId ? data.transactions.find(t=>t.id===editId) : null;
    const cats = data.categories;
    const typeLabel = {oblig:'Fixe', besoins:'Besoin', envies:'Envie'};
    const defaultMonth = existing ? (existing.month || existing.date.slice(0,7)) : data.currentMonth;
    const defaultDate = existing ? existing.date : todayISO();
    const defaultTxType = existing && Number(existing.amount) < 0 ? 'refund' : 'expense';
    openSheet(`
      <h3>${existing?'Modifier le mouvement':'Nouveau mouvement'}</h3>
      <div class="field"><label>Type</label>
        <div class="seg" id="txTypeSeg">
          <button type="button" data-txtype="expense" class="${defaultTxType==='expense'?'active':''}">Dépense</button>
          <button type="button" data-txtype="refund" class="${defaultTxType==='refund'?'active':''}">Remboursement</button>
        </div>
      </div>
      <div class="field"><label>Date</label><input type="date" id="fDate" value="${defaultDate}"></div>
      <div class="field"><label>Mois du budget</label><input type="month" id="fMonth" value="${defaultMonth}"></div>
      <div class="field"><label>Montant (€)</label><input type="number" step="0.01" min="0" id="fAmount" value="${existing?Math.abs(existing.amount):''}" placeholder="0,00"></div>
      <div class="field"><label>Catégorie</label>
        <select id="fCat">${cats.map(c=>`<option value="${c.id}" ${existing&&existing.categoryId===c.id?'selected':''}>${c.name} (${typeLabel[c.type]})</option>`).join('')}</select>
      </div>
      <div class="field"><label>Commerçant / libellé</label><input type="text" id="fVendor" value="${existing?escapeHtml(existing.vendor||''):''}" placeholder="Carrefour, Uber..."></div>
      <div class="field"><label>Note (optionnel)</label><input type="text" id="fNotes" value="${existing?escapeHtml(existing.notes||''):''}" placeholder=""></div>
      <button class="btn btn-primary" id="saveTx">Enregistrer</button>
      ${existing?'<button class="btn btn-danger" style="margin-top:10px;" id="delTxBtn">Supprimer</button>':''}
    `);
    let txType = defaultTxType;
    document.querySelectorAll('#txTypeSeg button').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        document.querySelectorAll('#txTypeSeg button').forEach(b=>b.classList.remove('active'));
        btn.classList.add('active'); txType = btn.dataset.txtype;
      });
    });
    document.getElementById('saveTx').addEventListener('click', async ()=>{
      const raw = parseFloat(document.getElementById('fAmount').value);
      if(isNaN(raw)) return;
      const amount = txType==='refund' ? -Math.abs(raw) : Math.abs(raw);
      const date = document.getElementById('fDate').value || todayISO();
      const month = document.getElementById('fMonth').value || date.slice(0,7);
      const payload = {
        date: date,
        month: month,
        amount: amount,
        categoryId: document.getElementById('fCat').value,
        vendor: document.getElementById('fVendor').value,
        notes: document.getElementById('fNotes').value
      };
      if (existing) {
        const updated = await updateTransaction(existing.id, payload);
        Object.assign(existing, mapTransaction(updated));
      } else {
        const created = await createTransaction(payload);
        data.transactions.push(mapTransaction(created));
      }
      render();
      closeSheet();
    });
    const delBtn = document.getElementById('delTxBtn');
    if(delBtn) delBtn.addEventListener('click', async ()=>{
      await deleteTransaction(existing.id);
      data.transactions = data.transactions.filter(t => t.id !== existing.id);
      render();
      closeSheet();
    });
  }

  function openIncomeSheet(editId){
    const existing = editId ? data.income.find(i=>i.id===editId) : null;
    openSheet(`
      <h3>${existing? 'Modifier le revenu':'Nouveau revenu'}</h3>
      <div class="field"><label>Nom</label><input type="text" id="fName" value="${existing?escapeHtml(existing.name):''}" placeholder="Salaire, freelance..."></div>
      <div class="field"><label>Montant mensuel (€)</label><input type="number" step="0.01" id="fAmount" value="${existing?existing.amount:''}"></div>
      <button class="btn btn-primary" id="saveIncome">Enregistrer</button>
    `);
    document.getElementById('saveIncome').addEventListener('click', async ()=>{
      const name = document.getElementById('fName').value.trim();
      const amount = parseFloat(document.getElementById('fAmount').value)||0;
      if(!name) return;
      if (existing) {
        const updated = await updateIncome(existing.id, { name, amount });
        Object.assign(existing, mapIncome(updated));
      } else {
        const created = await createIncome({ name, amount });
        data.income.push(mapIncome(created));
      }
      render();
      closeSheet();
    });
  }

  function openCategorySheet(editId){
    const existing = editId ? data.categories.find(c=>c.id===editId) : null;
    openSheet(`
      <h3>${existing? 'Modifier':'Nouvelle catégorie'}</h3>
      <div class="field"><label>Nom</label><input type="text" id="fName" value="${existing?escapeHtml(existing.name):''}" placeholder="Courses, Sorties..."></div>
      <div class="field"><label>Type</label>
        <div class="seg" id="typeSeg">
          <button type="button" data-type="oblig" class="${existing&&existing.type==='oblig'?'active':''}">Fixe</button>
          <button type="button" data-type="besoins" class="${(!existing||existing.type==='besoins')?'active':''}">Besoin</button>
          <button type="button" data-type="envies" class="${existing&&existing.type==='envies'?'active':''}">Envie</button>
        </div>
      </div>
      <div class="field"><label>Budget mensuel (€)</label><input type="number" step="0.01" id="fBudget" value="${existing?existing.budget:''}"></div>
      <div class="field" id="dueField" style="display:${existing&&existing.type==='oblig'?'block':'none'};"><label>Jour d'échéance</label><input type="number" min="1" max="31" id="fDue" value="${existing?existing.dueDay||'':''}" placeholder="ex: 5"></div>
      <button class="btn btn-primary" id="saveCat">Enregistrer</button>
      ${existing?'<button class="btn btn-danger" style="margin-top:10px;" id="delCat">Supprimer</button>':''}
    `);
    let selectedType = existing?existing.type:'besoins';
    document.querySelectorAll('#typeSeg button').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        document.querySelectorAll('#typeSeg button').forEach(b=>b.classList.remove('active'));
        btn.classList.add('active'); selectedType = btn.dataset.type;
        document.getElementById('dueField').style.display = selectedType==='oblig' ? 'block' : 'none';
      });
    });
    document.getElementById('saveCat').addEventListener('click', async ()=>{
      const name = document.getElementById('fName').value.trim();
      const budget = parseFloat(document.getElementById('fBudget').value)||0;
      const dueDay = parseInt(document.getElementById('fDue').value)||null;
      if(!name) return;
      const categoryPayload = {
        code: existing?.code || null,
        name,
        type: selectedType,
        budget,
        isBill: selectedType === 'oblig',
        dueDay: selectedType === 'oblig' ? dueDay : null
      };

      if (existing) {
        const updated = await updateCategory(existing.id, categoryPayload);
        Object.assign(existing, mapCategory(updated));
      } else {
        const created = await createCategory(categoryPayload);
        data.categories.push(mapCategory(created));
      }

      render();
      closeSheet();
    });
    const delBtn = document.getElementById('delCat');
    if(delBtn) delBtn.addEventListener('click', async ()=>{
      await deleteCategory(existing.id);
      data.categories = data.categories.filter(c => c.id !== existing.id);
      render();
      closeSheet();
    });
  }
  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    loginError.textContent = '';

    const email = loginEmail.value.trim();
    const password = loginPassword.value;

    if (!email || !password) {
      loginError.textContent =
        'Renseigne ton adresse e-mail et ton mot de passe.';
      return;
    }

    loginButton.disabled = true;
    loginButton.textContent = 'Connexion…';

    try {
      await signInWithPassword(email, password);
      await startAuthenticatedApplication();
    } catch (error) {
      console.error('Erreur de connexion :', error);

      loginError.textContent =
        'Connexion impossible. Vérifie ton adresse e-mail et ton mot de passe.';
    } finally {
      loginButton.disabled = false;
      loginButton.textContent = 'Se connecter';
    }
  });

  logoutButton.addEventListener('click', async () => {
    logoutButton.disabled = true;

    try {
      await signOut();
    } catch (error) {
      console.error('Erreur de déconnexion :', error);
    } finally {
      logoutButton.disabled = false;
    }
  });
    async function startAuthenticatedApplication() {
  // On masque immédiatement la connexion.
  showApplication();

  if (applicationLoaded) {
    return;
  }

  // Évite deux chargements simultanés :
  // un déclenché par la connexion et un par l’événement Supabase.
  if (!applicationLoadPromise) {
    applicationLoadPromise = load()
      .then(() => {
        applicationLoaded = true;
      })
      .finally(() => {
        applicationLoadPromise = null;
      });
  }

  try {
    await applicationLoadPromise;
  } catch (error) {
    console.error(
      'Erreur lors du chargement du budget :',
      error
    );

    applicationLoaded = false;

    alert(
      'La connexion a réussi, mais les données du budget n’ont pas pu être chargées. Consulte la console.'
    );
  }
}

function handleSignedOut() {
  applicationLoaded = false;
  applicationLoadPromise = null;
  data = null;

  loginPassword.value = '';
  showLogin();
}

async function initialiseApplication() {
  try {
    const session = await getCurrentSession();

    if (session) {
      await startAuthenticatedApplication();
    } else {
      showLogin();
    }

    await observeAuthChanges((newSession) => {
      /*
       * On sort d’abord du callback Supabase avant de lancer
       * d’autres requêtes Supabase.
       */
      setTimeout(() => {
        if (newSession) {
          startAuthenticatedApplication().catch((error) => {
            console.error(
              'Erreur après le changement de session :',
              error
            );
          });
        } else {
          handleSignedOut();
        }
      }, 0);
    });
  } catch (error) {
    console.error(
      'Erreur pendant l’initialisation de l’application :',
      error
    );

    loginError.textContent =
      'Impossible de démarrer l’application. Vérifie la configuration Supabase.';

    showLogin();
  }
}

initialiseApplication();
})();
