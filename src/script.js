(async () => {
  // Supabase Configuration
  const SUPABASE_URL = 'https://goivkbzwrdpomkeudtdf.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdvaXZrYnp3cmRwb21rZXVkdGRmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTExNTQyNjMsImV4cCI6MjEwNjczMDI2M30.pAl_U65O-IMVNuABlWlQK2_GYP6nBfhLPs-wjAL4Z5E';
  const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const STORAGE_KEY = 'persediaan-erd-v1';
  const entityNames = { barang: 'Barang', kategori: 'Kategori', pemasok: 'Pemasok', masuk: 'Transaksi masuk', keluar: 'Transaksi keluar' };
  const viewDetails = {
    ringkasan: { title: 'Ringkasan', eyebrow: 'KENDALI OPERASIONAL', description: 'Pantau posisi barang dan pergerakan persediaan.', addLabel: 'Tambah barang' },
    barang: { title: 'Barang', eyebrow: 'DATA MASTER', description: 'Kelola barang, batas minimum, dan informasi pemasok.', addLabel: 'Tambah barang' },
    kategori: { title: 'Kategori', eyebrow: 'DATA MASTER', description: 'Kelompokkan barang agar mudah ditelusuri.', addLabel: 'Tambah kategori' },
    pemasok: { title: 'Pemasok', eyebrow: 'DATA MASTER', description: 'Simpan kontak pemasok yang terkait dengan barang.', addLabel: 'Tambah pemasok' },
    masuk: { title: 'Barang masuk', eyebrow: 'PERGERAKAN STOK', description: 'Catat penerimaan dan penambahan jumlah barang.', addLabel: 'Catat barang masuk' },
    keluar: { title: 'Barang keluar', eyebrow: 'PERGERAKAN STOK', description: 'Catat pengeluaran barang dan jaga saldo tetap akurat.', addLabel: 'Catat barang keluar' }
  };
  const fieldDefinitions = {
    kategori: [
      { name: 'name', label: 'Nama kategori', required: true, maxLength: 80 },
      { name: 'description', label: 'Keterangan', type: 'textarea', wide: true, maxLength: 240 }
    ],
    pemasok: [
      { name: 'name', label: 'Nama pemasok', required: true, maxLength: 100 },
      { name: 'contact', label: 'Kontak', maxLength: 60 },
      { name: 'email', label: 'Email', type: 'email', maxLength: 120 },
      { name: 'address', label: 'Alamat', type: 'textarea', wide: true, maxLength: 240 }
    ],
    barang: [
      { name: 'sku', label: 'SKU', required: true, maxLength: 40 },
      { name: 'name', label: 'Nama barang', required: true, maxLength: 100 },
      { name: 'categoryId', label: 'Kategori', type: 'select', collection: 'categories', required: true },
      { name: 'supplierId', label: 'Pemasok', type: 'select', collection: 'suppliers', required: true },
      { name: 'stock', label: 'Stok saat ini', type: 'number', min: 0, required: true },
      { name: 'minStock', label: 'Batas stok minimum', type: 'number', min: 0, required: true },
      { name: 'price', label: 'Harga satuan (Rp)', type: 'number', min: 0, step: 1, required: true }
    ],
    masuk: [
      { name: 'itemId', label: 'Barang', type: 'select', collection: 'items', required: true },
      { name: 'quantity', label: 'Jumlah masuk', type: 'number', min: 1, step: 1, required: true },
      { name: 'date', label: 'Tanggal', type: 'date', required: true },
      { name: 'note', label: 'Catatan', type: 'textarea', wide: true, maxLength: 240 }
    ],
    keluar: [
      { name: 'itemId', label: 'Barang', type: 'select', collection: 'items', required: true },
      { name: 'quantity', label: 'Jumlah keluar', type: 'number', min: 1, step: 1, required: true },
      { name: 'date', label: 'Tanggal', type: 'date', required: true },
      { name: 'note', label: 'Catatan', type: 'textarea', wide: true, maxLength: 240 }
    ]
  };

  const pageContent = document.getElementById('pageContent');
  const dialog = document.getElementById('recordDialog');
  const recordForm = document.getElementById('recordForm');
  const formFields = document.getElementById('formFields');
  const formError = document.getElementById('formError');
  const appShell = document.getElementById('appShell');
  let store = emptyStore();
  let currentView = 'ringkasan';
  let editingId = null;
  let searchQuery = '';

  function emptyStore() {
    return { categories: [], suppliers: [], items: [], incoming: [], outgoing: [] };
  }

  async function loadStore() {
    try {
      const [
        { data: categories, error: errCategories },
        { data: suppliers, error: errSuppliers },
        { data: items, error: errItems },
        { data: incoming, error: errIncoming },
        { data: outgoing, error: errOutgoing }
      ] = await Promise.all([
        supabase.from('categories').select('*'),
        supabase.from('suppliers').select('*'),
        supabase.from('items').select('*'),
        supabase.from('incoming').select('*'),
        supabase.from('outgoing').select('*')
      ]);

      if (errCategories || errSuppliers || errItems || errIncoming || errOutgoing) {
        throw new Error('Gagal memuat data dari database.');
      }

      return {
        categories: categories || [],
        suppliers: suppliers || [],
        items: items || [],
        incoming: incoming || [],
        outgoing: outgoing || []
      };
    } catch (error) {
      console.error(error);
      announce('Gagal memuat data.');
      return emptyStore();
    }
  }


  function announce(message) { document.getElementById('statusMessage').textContent = message; }
  function makeId() { return globalThis.crypto?.randomUUID?.() || `rec-${Date.now()}-${Math.random().toString(16).slice(2)}`; }

  function collectionFor(view) {
    return { kategori: 'categories', pemasok: 'suppliers', barang: 'items', masuk: 'incoming', keluar: 'outgoing' }[view];
  }

  function formatNumber(value) { return new Intl.NumberFormat('id-ID').format(Number(value) || 0); }

  function formatCurrency(value) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(value) || 0);
  }

  function formatDate(value) {
    if (!value) return '—';
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
  }

  function localDateValue() {
    const today = new Date();
    const localTime = new Date(today.getTime() - today.getTimezoneOffset() * 60000);
    return localTime.toISOString().slice(0, 10);
  }

  function nameFor(collection, id) {
    const row = store[collection].find((record) => record.id === id);
    return row?.name || 'Data tidak ditemukan';
  }

  async function setView(view) {
    if (view !== 'ringkasan' && !entityNames[view]) return;
    currentView = view;
    searchQuery = '';
    document.getElementById('menuToggle').setAttribute('aria-expanded', 'false');
    appShell.classList.remove('is-nav-open');
    store = await loadStore();
    render();
  }

  function render() {
    const details = viewDetails[currentView];
    document.getElementById('pageTitle').textContent = details.title;
    document.getElementById('pageEyebrow').textContent = details.eyebrow;
    document.getElementById('pageDescription').textContent = details.description;
    document.getElementById('addButtonLabel').textContent = details.addLabel;
    document.getElementById('breadcrumbCurrent').textContent = details.title;
    document.getElementById('todayLabel').textContent = new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());

    document.querySelectorAll('[data-view]').forEach((button) => {
      const active = button.dataset.view === currentView;
      button.classList.toggle('is-active', active);
      if (button.classList.contains('nav-link')) {
        if (active) button.setAttribute('aria-current', 'page');
        else button.removeAttribute('aria-current');
      }
    });
    document.getElementById('addRecordButton').hidden = currentView === 'ringkasan';
    pageContent.replaceChildren();
    if (currentView === 'ringkasan') renderOverview();
    else renderEntityPage();
  }

  function createMetric(label, value, critical = false) {
    const article = document.createElement('article');
    article.className = `metric${critical ? ' metric--critical' : ''}`;
    const title = document.createElement('p');
    title.className = 'metric__label';
    title.textContent = label;
    const number = document.createElement('p');
    number.className = 'metric__value';
    number.textContent = formatNumber(value);
    article.append(title, number);
    return article;
  }

  function renderOverview() {
    const criticalCount = store.items.filter((item) => Number(item.stock) <= Number(item.minStock)).length;
    const metrics = document.createElement('section');
    metrics.className = 'metrics-grid';
    metrics.setAttribute('aria-label', 'Ringkasan persediaan');
    metrics.append(
      createMetric('Jenis barang', store.items.length),
      createMetric('Stok di bawah minimum', criticalCount, true),
      createMetric('Transaksi masuk', store.incoming.length),
      createMetric('Transaksi keluar', store.outgoing.length)
    );

    const quickLinks = document.createElement('section');
    quickLinks.className = 'quick-links';
    quickLinks.setAttribute('aria-label', 'Jumlah data per entitas');
    [['barang', 'Barang', store.items.length], ['kategori', 'Kategori', store.categories.length], ['pemasok', 'Pemasok', store.suppliers.length], ['masuk', 'Barang masuk', store.incoming.length], ['keluar', 'Barang keluar', store.outgoing.length]].forEach(([view, label, count]) => {
      const button = document.createElement('button');
      button.className = 'quick-link';
      button.type = 'button';
      button.dataset.view = view;
      const name = document.createElement('span');
      name.className = 'quick-link__name';
      name.textContent = label;
      const total = document.createElement('span');
      total.className = 'quick-link__count';
      total.textContent = formatNumber(count);
      button.append(name, total);
      quickLinks.append(button);
    });

    const panel = createPanel('Perlu perhatian', 'Barang yang sudah mencapai atau melewati batas stok minimum.');
    const criticalItems = store.items.filter((item) => Number(item.stock) <= Number(item.minStock));
    if (criticalItems.length) {
      panel.body.append(createTable('barang', criticalItems));
    } else {
      panel.body.append(createEmptyState(
        store.items.length ? 'Tidak ada stok kritis' : 'Belum ada data barang',
        store.items.length ? 'Semua barang masih berada di atas batas stok minimum.' : 'Tambahkan kategori dan pemasok terlebih dahulu, lalu catat barang untuk memulai.'
      ));
      if (!store.items.length) {
        const links = document.createElement('div');
        links.className = 'empty-links';
        links.append(makeViewButton('kategori', 'Tambah kategori'), makeViewButton('pemasok', 'Tambah pemasok'));
        panel.body.append(links);
      }
    }
    pageContent.append(metrics, quickLinks, panel.element);
  }

  function createPanel(title, description) {
    const element = document.createElement('section');
    element.className = 'section-panel';
    const header = document.createElement('div');
    header.className = 'panel-heading';
    const titleGroup = document.createElement('div');
    const heading = document.createElement('h2');
    heading.textContent = title;
    const detail = document.createElement('p');
    detail.className = 'panel-heading__meta';
    detail.textContent = description;
    titleGroup.append(heading, detail);
    header.append(titleGroup);
    const body = document.createElement('div');
    element.append(header, body);
    return { element, body, header };
  }

  function makeViewButton(view, label) {
    const button = document.createElement('button');
    button.className = 'button button--quiet';
    button.type = 'button';
    button.dataset.view = view;
    button.textContent = label;
    return button;
  }

  function createEmptyState(title, description) {
    const section = document.createElement('div');
    section.className = 'empty-state';
    const heading = document.createElement('h3');
    heading.textContent = title;
    const detail = document.createElement('p');
    detail.textContent = description;
    section.append(heading, detail);
    return section;
  }

  function renderEntityPage() {
    const config = tableConfig(currentView);
    const panel = createPanel(config.title, config.description);
    const search = document.createElement('input');
    search.className = 'search-field';
    search.id = 'recordSearch';
    search.type = 'search';
    search.placeholder = `Cari ${entityNames[currentView].toLowerCase()}`;
    search.setAttribute('aria-label', `Cari ${entityNames[currentView].toLowerCase()}`);
    search.value = searchQuery;
    panel.header.append(search);
    panel.body.id = 'tableBody';
    pageContent.append(panel.element);
    renderTableBody();
  }

  function tableConfig(view) {
    return {
      barang: { title: 'Daftar barang', description: 'Stok dan status dihitung dari data saat ini.', columns: ['SKU', 'Nama barang', 'Kategori', 'Pemasok', 'Stok', 'Harga satuan'] },
      kategori: { title: 'Daftar kategori', description: 'Kategori yang menjadi pengelompokan data barang.', columns: ['Nama kategori', 'Keterangan', 'Jumlah barang'] },
      pemasok: { title: 'Daftar pemasok', description: 'Kontak pemasok yang tercatat pada sistem.', columns: ['Nama pemasok', 'Kontak', 'Email', 'Jumlah barang'] },
      masuk: { title: 'Riwayat barang masuk', description: 'Penerimaan menambah saldo barang terkait.', columns: ['Tanggal', 'Barang', 'Jumlah masuk', 'Catatan'] },
      keluar: { title: 'Riwayat barang keluar', description: 'Pengeluaran mengurangi saldo barang terkait.', columns: ['Tanggal', 'Barang', 'Jumlah keluar', 'Catatan'] }
    }[view];
  }

  function getRows(view) {
    const rows = store[collectionFor(view)].slice();
    if (['barang', 'kategori', 'pemasok'].includes(view)) return rows.sort((a, b) => String(a.name).localeCompare(String(b.name), 'id'));
    return rows.sort((a, b) => String(b.date).localeCompare(String(a.date)));
  }

  function searchableValues(view, row) {
    if (view === 'barang') return [row.sku, row.name, nameFor('categories', row.categoryId), nameFor('suppliers', row.supplierId)];
    if (view === 'kategori') return [row.name, row.description];
    if (view === 'pemasok') return [row.name, row.contact, row.email, row.address];
    return [row.date, nameFor('items', row.itemId), row.note];
  }

  function renderTableBody() {
    const target = document.getElementById('tableBody');
    if (!target) return;
    const query = searchQuery.trim().toLocaleLowerCase('id');
    const rows = getRows(currentView).filter((row) => searchableValues(currentView, row).some((value) => String(value ?? '').toLocaleLowerCase('id').includes(query)));
    target.replaceChildren();
    if (!rows.length) {
      target.append(createEmptyState(query ? 'Tidak ada hasil yang cocok' : `Belum ada ${entityNames[currentView].toLowerCase()}`, query ? 'Coba kata pencarian lain.' : emptyDescription(currentView)));
      return;
    }
    const scroll = document.createElement('div');
    scroll.className = 'table-scroll';
    scroll.append(createTable(currentView, rows));
    target.append(scroll);
  }

  function emptyDescription(view) {
    return {
      barang: 'Tambahkan kategori dan pemasok sebelum membuat data barang.',
      kategori: 'Buat kategori untuk mengelompokkan barang.',
      pemasok: 'Tambahkan kontak pemasok sebelum mencatat barang.',
      masuk: 'Transaksi masuk yang dicatat akan menambah saldo barang.',
      keluar: 'Transaksi keluar yang dicatat akan mengurangi saldo barang.'
    }[view];
  }

  function createTable(view, rows) {
    const table = document.createElement('table');
    table.className = 'data-table';
    const head = document.createElement('thead');
    const headRow = document.createElement('tr');
    tableConfig(view).columns.forEach((label) => {
      const th = document.createElement('th');
      th.scope = 'col';
      th.textContent = label;
      headRow.append(th);
    });
    const actionHeading = document.createElement('th');
    actionHeading.scope = 'col';
    actionHeading.textContent = 'Aksi';
    headRow.append(actionHeading);
    head.append(headRow);
    const body = document.createElement('tbody');
    rows.forEach((row) => body.append(createTableRow(view, row)));
    table.append(head, body);
    return table;
  }

  function createTableRow(view, row) {
    const tr = document.createElement('tr');
    rowValues(view, row).forEach((value, index) => {
      const td = document.createElement('td');
      if (view === 'barang' && index === 0) {
        const sku = document.createElement('span');
        sku.className = 'table-primary';
        sku.textContent = value;
        td.append(sku);
      } else if (view === 'barang' && index === 4) {
        const quantity = document.createElement('span');
        quantity.className = 'stock-value';
        quantity.textContent = formatNumber(row.stock);
        const badge = document.createElement('span');
        const critical = Number(row.stock) <= Number(row.minStock);
        badge.className = `stock-badge${critical ? ' stock-badge--critical' : ''}`;
        badge.textContent = critical ? 'Kritis' : 'Aman';
        td.append(quantity, document.createTextNode('  '), badge);
      } else {
        td.textContent = value;
      }
      tr.append(td);
    });
    const actions = document.createElement('td');
    const group = document.createElement('div');
    group.className = 'row-actions';
    group.append(makeActionButton('edit', view, row.id, 'Ubah'), makeActionButton('delete', view, row.id, 'Hapus', true));
    actions.append(group);
    tr.append(actions);
    return tr;
  }

  function rowValues(view, row) {
    if (view === 'barang') return [String(row.sku || ''), String(row.name || ''), nameFor('categories', row.categoryId), nameFor('suppliers', row.supplierId), formatNumber(row.stock), formatCurrency(row.price)];
    if (view === 'kategori') return [String(row.name || ''), String(row.description || '—'), formatNumber(store.items.filter((item) => item.categoryId === row.id).length)];
    if (view === 'pemasok') return [String(row.name || ''), String(row.contact || '—'), String(row.email || '—'), formatNumber(store.items.filter((item) => item.supplierId === row.id).length)];
    return [formatDate(row.date), nameFor('items', row.itemId), formatNumber(row.quantity), String(row.note || '—')];
  }

  function makeActionButton(action, view, id, label, danger = false) {
    const button = document.createElement('button');
    button.className = `text-button${danger ? ' text-button--danger' : ''}`;
    button.type = 'button';
    button.dataset.action = action;
    button.dataset.entity = view;
    button.dataset.id = id;
    button.textContent = label;
    button.setAttribute('aria-label', `${label} ${entityNames[view].toLowerCase()}`);
    return button;
  }

  function openForm(view, id = null) {
    if (view === 'ringkasan') view = 'barang';
    const record = id ? store[collectionFor(view)].find((item) => item.id === id) : null;
    if (id && !record) return;
    currentView = view;
    editingId = id;
    formError.textContent = '';
    document.getElementById('dialogTitle').textContent = `${id ? 'Ubah' : 'Tambah'} ${entityNames[view].toLowerCase()}`;
    document.getElementById('saveRecordButton').textContent = id ? 'Simpan perubahan' : 'Simpan data';
    formFields.replaceChildren();

    fieldDefinitions[view].forEach((definition) => {
      const field = document.createElement('div');
      field.className = `field${definition.wide ? ' field--wide' : ''}`;
      const label = document.createElement('label');
      label.htmlFor = `field-${definition.name}`;
      label.textContent = definition.label;
      const control = makeFieldControl(definition, record);
      field.append(label, control);
      if (definition.type === 'select' && store[definition.collection].length === 0) {
        const help = document.createElement('p');
        help.className = 'field-help';
        help.append(document.createTextNode(`${entityLabelForCollection(definition.collection)} belum tersedia. `));
        const link = document.createElement('button');
        link.type = 'button';
        link.dataset.view = viewForCollection(definition.collection);
        link.textContent = 'Buat sekarang';
        help.append(link);
        field.append(help);
      }
      formFields.append(field);
    });
    dialog.showModal();
    formFields.querySelector('input, select, textarea')?.focus();
  }

  function makeFieldControl(definition, record) {
    let control;
    if (definition.type === 'select') {
      control = document.createElement('select');
      control.append(new Option('Pilih data', ''));
      store[definition.collection].forEach((optionRecord) => control.append(new Option(optionRecord.name, optionRecord.id)));
      control.disabled = store[definition.collection].length === 0;
    } else if (definition.type === 'textarea') {
      control = document.createElement('textarea');
    } else {
      control = document.createElement('input');
      control.type = definition.type || 'text';
    }
    control.id = `field-${definition.name}`;
    control.name = definition.name;
    control.required = Boolean(definition.required);
    if (definition.maxLength) control.maxLength = definition.maxLength;
    if (definition.min !== undefined) control.min = String(definition.min);
    if (definition.step !== undefined) control.step = String(definition.step);
    const value = record?.[definition.name];
    if (value !== undefined && value !== null) control.value = String(value);
    else if (definition.name === 'date') control.value = localDateValue();
    else if (['stock', 'minStock', 'price'].includes(definition.name)) control.value = '0';
    return control;
  }

  function entityLabelForCollection(collection) { return { categories: 'Kategori', suppliers: 'Pemasok', items: 'Barang' }[collection]; }
  function viewForCollection(collection) { return { categories: 'kategori', suppliers: 'pemasok', items: 'barang' }[collection]; }

  function readForm(view) {
    const values = Object.fromEntries(new FormData(recordForm).entries());
    for (const definition of fieldDefinitions[view]) {
      if (definition.required && !String(values[definition.name] ?? '').trim()) throw new Error(`${definition.label} wajib diisi.`);
      if (definition.type === 'number' && values[definition.name] !== '') {
        const number = Number(values[definition.name]);
        if (!Number.isFinite(number) || number < Number(definition.min ?? 0)) throw new Error(`${definition.label} harus berupa angka yang valid.`);
        values[definition.name] = number;
      } else if (typeof values[definition.name] === 'string') {
        values[definition.name] = values[definition.name].trim();
      }
    }
    if (view === 'barang') {
      const duplicateSku = store.items.some((item) => item.id !== editingId && item.sku.toLocaleLowerCase('id') === values.sku.toLocaleLowerCase('id'));
      if (duplicateSku) throw new Error('SKU sudah digunakan barang lain.');
    }
    if (view === 'kategori' || view === 'pemasok') {
      const collection = collectionFor(view);
      const duplicateName = store[collection].some((item) => item.id !== editingId && item.name.toLocaleLowerCase('id') === values.name.toLocaleLowerCase('id'));
      if (duplicateName) throw new Error(`${entityNames[view]} dengan nama tersebut sudah ada.`);
    }
    return values;
  }


  async function saveRecord(event) {
    event.preventDefault();
    const view = currentView;
    try {
      const values = readForm(view);
      // Removed optimistic application as Supabase trigger will handle it
      // const nextBalances = view === 'masuk' || view === 'keluar' ? applyTransaction(view, values) : null;

      const collectionName = { kategori: 'categories', pemasok: 'suppliers', barang: 'items', masuk: 'incoming', keluar: 'outgoing' }[view];

      let error;
      if (editingId) {
        const { error: updateError } = await supabase.from(collectionName).update(values).eq('id', editingId);
        error = updateError;
      } else {
        const { error: insertError } = await supabase.from(collectionName).insert([values]);
        error = insertError;
      }

      if (error) {
        throw new Error(error.message || 'Gagal menyimpan data ke database.');
      }

      dialog.close();
      announce(`${entityNames[view]} berhasil ${editingId ? 'diperbarui' : 'ditambahkan'}.`);
      editingId = null;
      store = await loadStore();
      render();
    } catch (error) {
      formError.textContent = error.message;
    }
  }

  async function deleteRecord(view, id) {
    const collection = collectionFor(view);
    const record = store[collection].find((item) => item.id === id);
    if (!record) return;
    const related = {
      kategori: store.items.some((item) => item.categoryId === id),
      pemasok: store.items.some((item) => item.supplierId === id),
      barang: [...store.incoming, ...store.outgoing].some((item) => item.itemId === id)
    }[view];
    if (related) {
      announce(`${entityNames[view]} masih digunakan data lain dan tidak dapat dihapus.`);
      return;
    }
    if (!window.confirm(`Hapus ${entityNames[view].toLowerCase()} ini? Tindakan ini tidak dapat dibatalkan.`)) return;

    if (view === 'masuk' || view === 'keluar') {
      const item = store.items.find((entry) => entry.id === record.itemId);
      if (item) {
        const nextStock = Number(item.stock) + (view === 'masuk' ? -1 : 1) * Number(record.quantity);
        if (nextStock < 0) {
          announce('Transaksi tidak dapat dihapus karena akan membuat stok negatif.');
          return;
        }
      }
    }

    const collectionName = { kategori: 'categories', pemasok: 'suppliers', barang: 'items', masuk: 'incoming', keluar: 'outgoing' }[view];
    const { error } = await supabase.from(collectionName).delete().eq('id', id);

    if (error) {
      announce(`Gagal menghapus data: ${error.message}`);
      return;
    }

    announce(`${entityNames[view]} berhasil dihapus.`);
    store = await loadStore();
    render();
  }

  document.addEventListener('click', (event) => {
    const viewButton = event.target.closest('[data-view]');
    if (viewButton) {
      event.preventDefault();
      setView(viewButton.dataset.view);
      return;
    }
    const actionButton = event.target.closest('[data-action]');
    if (actionButton) {
      if (actionButton.dataset.action === 'edit') openForm(actionButton.dataset.entity, actionButton.dataset.id);
      if (actionButton.dataset.action === 'delete') deleteRecord(actionButton.dataset.entity, actionButton.dataset.id);
    }
  });

  document.getElementById('addRecordButton').addEventListener('click', () => openForm(currentView));
  document.getElementById('menuToggle').addEventListener('click', (event) => {
    const isOpen = appShell.classList.toggle('is-nav-open');
    event.currentTarget.setAttribute('aria-expanded', String(isOpen));
  });
  document.getElementById('navBackdrop').addEventListener('click', () => {
    appShell.classList.remove('is-nav-open');
    document.getElementById('menuToggle').setAttribute('aria-expanded', 'false');
  });
  document.getElementById('closeDialogButton').addEventListener('click', () => dialog.close());
  document.getElementById('cancelDialogButton').addEventListener('click', () => dialog.close());
  recordForm.addEventListener('submit', saveRecord);
  dialog.addEventListener('close', () => {
    editingId = null;
    formError.textContent = '';
  });
  pageContent.addEventListener('input', (event) => {
    if (event.target.id === 'recordSearch') {
      searchQuery = event.target.value;
      renderTableBody();
      const replacement = document.getElementById('recordSearch');
      replacement?.focus();
      replacement?.setSelectionRange(searchQuery.length, searchQuery.length);
    }
  });

  store = await loadStore();
  render();
})();