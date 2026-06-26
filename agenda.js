const MONTHS = [
    'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
    'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'
];

const COLORS = ['blue','teal','coral','pink','amber','green','purple'];

let curDate = new Date();
curDate.setDate(1);

let events = [];
let colorIdx = 0;
let editId = null;

/* ── Persistência (API do servidor) ── */

const COLECAO = "agenda";

async function loadEvents() {
    try {
        events = await apiListar(COLECAO);
    } catch (e) {
        console.error(e);
        alert("Não foi possível carregar a agenda. Verifique sua conexão e recarregue a página.");
        events = [];
    }
}

/* ── Helpers ── */

function pad(n) {
    return String(n).padStart(2, '0');
}

function todayStr() {
    const n = new Date();
    return `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}`;
}

function fmtDate(ds) {
    const [y, m, d] = ds.split('-');
    return `${d}/${m}/${y}`;
}

/* ── Renderizar grade mensal ── */

function render() {

    const grid  = document.getElementById('calGrid');
    const label = document.getElementById('monthLabel');

    label.textContent = MONTHS[curDate.getMonth()] + ' ' + curDate.getFullYear();
    grid.innerHTML = '';

    const year     = curDate.getFullYear();
    const month    = curDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const lastDate = new Date(year, month + 1, 0).getDate();
    const prevLast = new Date(year, month, 0).getDate();
    const total    = Math.ceil((firstDay + lastDate) / 7) * 7;
    const today    = todayStr();

    for (let i = 0; i < total; i++) {

        let d, m2 = month, isOther = false;

        if (i < firstDay) {
            d  = prevLast - firstDay + i + 1;
            m2 = month - 1;
            isOther = true;
        } else if (i >= firstDay + lastDate) {
            d  = i - firstDay - lastDate + 1;
            m2 = month + 1;
            isOther = true;
        } else {
            d = i - firstDay + 1;
        }

        const y2 = m2 < 0 ? year - 1 : (m2 > 11 ? year + 1 : year);
        const mn = ((m2 % 12) + 12) % 12;
        const ds = `${y2}-${pad(mn + 1)}-${pad(d)}`;

        const cell = document.createElement('div');
        cell.className =
            'cal-cell' +
            (isOther ? ' other-month' : '') +
            (ds === today ? ' today' : '');

        const num = document.createElement('div');
        num.className = 'day-num';
        num.textContent = d;
        cell.appendChild(num);

        const dayEvts = events.filter(e => e.date === ds);

        dayEvts.slice(0, 3).forEach(ev => {
            const pill = document.createElement('div');
            pill.className = `evt-pill ${ev.color || 'blue'}`;
            pill.textContent = (ev.time ? ev.time + ' ' : '') + ev.title;
            pill.title = ev.title;
            pill.onclick = e => { e.stopPropagation(); openDetail(ev); };
            cell.appendChild(pill);
        });

        if (dayEvts.length > 3) {
            const more = document.createElement('div');
            more.className = 'evt-more';
            more.textContent = `+${dayEvts.length - 3} mais`;
            cell.appendChild(more);
        }

        cell.onclick = () => openNew(ds);
        grid.appendChild(cell);
    }
}

/* ── Modal: novo / editar evento ── */

function openNew(ds) {
    editId = null;
    document.getElementById('mModalTitle').textContent = 'Novo evento';
    document.getElementById('mTitle').value      = '';
    document.getElementById('mDate').value       = ds || todayStr();
    document.getElementById('mTimeStart').value  = '09:00';
    document.getElementById('mTimeEnd').value    = '10:00';
    document.getElementById('mResp').value       = '';
    document.getElementById('mDesc').value       = '';
    document.getElementById('newModal').classList.add('active');
    document.getElementById('mTitle').focus();
}

function closeNew() {
    document.getElementById('newModal').classList.remove('active');
}

async function saveEvt() {

    const title = document.getElementById('mTitle').value.trim();
    if (!title) {
        document.getElementById('mTitle').focus();
        return;
    }

    const existingColor = editId
        ? (events.find(e => e.id === editId) || {}).color || 'blue'
        : COLORS[colorIdx++ % COLORS.length];

    const dadosEvento = {
        title,
        date:    document.getElementById('mDate').value,
        time:    document.getElementById('mTimeStart').value,
        timeEnd: document.getElementById('mTimeEnd').value,
        resp:    document.getElementById('mResp').value.trim(),
        desc:    document.getElementById('mDesc').value.trim(),
        color:   existingColor
    };

    try {
        if (editId) {
            const evAtualizado = await apiAtualizar(COLECAO, editId, { ...dadosEvento, id: editId });
            events = events.map(e => e.id === editId ? evAtualizado : e);
        } else {
            const evCriado = await apiCriar(COLECAO, dadosEvento);
            events.push(evCriado);
        }
    } catch (e) {
        console.error(e);
        alert('Não foi possível salvar o evento. Verifique sua conexão e tente novamente.');
        return;
    }

    closeNew();
    render();
}

/* ── Modal: detalhes do evento ── */

function openDetail(ev) {

    const pill = document.getElementById('dtPill');
    pill.textContent = ev.title;
    pill.className   = `detail-pill evt-pill ${ev.color || 'blue'}`;

    document.getElementById('dtDate').textContent =
        fmtDate(ev.date);

    document.getElementById('dtTime').textContent =
        ev.time
            ? ev.time + (ev.timeEnd ? ' → ' + ev.timeEnd : '')
            : 'Horário não definido';

    document.getElementById('dtResp').textContent =
        ev.resp || 'Sem responsável';

    document.getElementById('dtDesc').textContent =
        ev.desc || 'Sem descrição';

    document.getElementById('dtDelBtn').onclick = async () => {
        try {
            await apiExcluir(COLECAO, ev.id);
        } catch (e) {
            console.error(e);
            alert('Não foi possível excluir o evento. Verifique sua conexão e tente novamente.');
            return;
        }
        events = events.filter(e => e.id !== ev.id);
        closeDetail();
        render();
    };

    document.getElementById('dtEditBtn').onclick = () => {
        closeDetail();
        editId = ev.id;
        document.getElementById('mModalTitle').textContent = 'Editar evento';
        document.getElementById('mTitle').value     = ev.title;
        document.getElementById('mDate').value      = ev.date;
        document.getElementById('mTimeStart').value = ev.time    || '';
        document.getElementById('mTimeEnd').value   = ev.timeEnd || '';
        document.getElementById('mResp').value      = ev.resp    || '';
        document.getElementById('mDesc').value      = ev.desc    || '';
        document.getElementById('newModal').classList.add('active');
        document.getElementById('mTitle').focus();
    };

    document.getElementById('detailModal').classList.add('active');
}

function closeDetail() {
    document.getElementById('detailModal').classList.remove('active');
}

/* ── Event listeners ── */

document.getElementById('prevBtn').onclick = () => {
    curDate.setMonth(curDate.getMonth() - 1);
    render();
};

document.getElementById('nextBtn').onclick = () => {
    curDate.setMonth(curDate.getMonth() + 1);
    render();
};

document.getElementById('todayBtn').onclick = () => {
    curDate = new Date();
    curDate.setDate(1);
    render();
};

document.getElementById('newEvtBtn').onclick = () => openNew(todayStr());

document.getElementById('closeNewModal').onclick  = closeNew;
document.getElementById('cancelNewModal').onclick = closeNew;
document.getElementById('saveEvtBtn').onclick     = saveEvt;
document.getElementById('closeDetailModal').onclick = closeDetail;

// Fechar clicando fora do modal
document.getElementById('newModal').onclick = e => {
    if (e.target === e.currentTarget) closeNew();
};

document.getElementById('detailModal').onclick = e => {
    if (e.target === e.currentTarget) closeDetail();
};

// Salvar com Enter no campo título
document.getElementById('mTitle').addEventListener('keydown', e => {
    if (e.key === 'Enter') saveEvt();
});

/* ── Init ── */

(async function iniciar() {
    await loadEvents();
    render();
})();
