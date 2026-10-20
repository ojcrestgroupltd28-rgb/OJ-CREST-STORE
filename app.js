(() => {
  'use strict';

  const KEY = 'ojcrest_store_v1';

  const money = n =>
    '₦' + Number(n || 0).toLocaleString('en-NG', {
      maximumFractionDigits: 0
    });

  const esc = s =>
    String(s ?? '').replace(/[&<>"']/g, c => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[c]));

  const seed = {
    products: [
      {
        id: 'p1',
        name: 'Signature Crest Polo',
        category: 'Fashion',
        price: 18500,
        stock: 24,
        published: true,
        image: '',
        description: 'A clean everyday essential with a refined finish.'
      },
      {
        id: 'p2',
        name: 'Heritage Carryall',
        category: 'Accessories',
        price: 32000,
        stock: 12,
        published: true,
        image: '',
        description: 'A versatile carryall for workdays and weekends.'
      },
      {
        id: 'p3',
        name: 'Executive Desk Set',
        category: 'Lifestyle',
        price: 27500,
        stock: 8,
        published: true,
        image: '',
        description: 'Bring a considered touch to your workspace.'
      },
      {
        id: 'p4',
        name: 'Classic Timepiece',
        category: 'Accessories',
        price: 48500,
        stock: 5,
        published: true,
        image: '',
        description: 'A timeless accent designed to elevate your look.'
      },
      {
        id: 'p5',
        name: 'Crest Gift Box',
        category: 'Gifts',
        price: 15000,
        stock: 18,
        published: true,
        image: '',
        description: 'A thoughtful gift, presented with care.'
      },
      {
        id: 'p6',
        name: 'Everyday Essentials Kit',
        category: 'Lifestyle',
        price: 12000,
        stock: 3,
        published: false,
        image: '',
        description: 'A curated collection of everyday essentials.'
      }
    ],
    orders: [],
    cart: []
  };

  function getDB() {
    try {
      const d = JSON.parse(localStorage.getItem(KEY));

      if (
        d &&
        Array.isArray(d.products) &&
        Array.isArray(d.orders)
      ) {
        if (!Array.isArray(d.cart)) d.cart = [];

        if (d.products.length === 0) {
          d.products = structuredClone(seed.products);
          localStorage.setItem(KEY, JSON.stringify(d));
        }

        return d;
      }
    } catch (error) {
      console.warn('Could not read saved store data:', error);
    }

    localStorage.setItem(KEY, JSON.stringify(seed));
    return structuredClone(seed);
  }

  let db = getDB();

  function save() {
    localStorage.setItem(KEY, JSON.stringify(db));
    window.dispatchEvent(new Event('ojcrest-update'));
  }

  // SUPABASE PRODUCT CONNECTION
  async function loadProductsFromSupabase() {
    try {
      if (
        !window.supabase ||
        typeof supabaseClient === 'undefined'
      ) {
        console.warn(
          'Supabase is not configured. Using saved local products.'
        );
        return;
      }

      const { data, error } = await supabaseClient
        .from('products')
        .select('*')
        .eq('is_active', true);

      if (error) {
        console.error(
          'Supabase product loading error:',
          error.message
        );
        return;
      }

      if (!Array.isArray(data)) {
        console.warn('Supabase returned no product list.');
        return;
      }

      // Convert Supabase fields to the fields used by this website.
      const products = data.map(p => ({
        id: String(p.id),
        name: p.name || '',
        description: p.description || '',
        category: p.category || 'General',
        price: Number(p.price) || 0,
        stock: Number(p.stock) || 0,
        image: p.image_url || '',
        published: p.is_active === true
      }));

      db.products = products;

      // Remove cart items whose products are no longer available.
      db.cart = db.cart.filter(c =>
        products.some(p => p.id === String(c.id))
      );

      save();

      if (document.body.dataset.page === 'store') {
        renderStore();
      }

      if (document.body.dataset.page === 'admin') {
        renderAdmin();
      }

      console.log(
        `Supabase connected. Loaded ${products.length} active products.`
      );
    } catch (error) {
      console.error(
        'Supabase connection error:',
        error.message || error
      );
    }
  }

  function toast(msg) {
    const el = document.getElementById('toast');
    if (!el) return;

    el.textContent = msg;
    el.classList.add('show');

    clearTimeout(toast.t);

    toast.t = setTimeout(() => {
      el.classList.remove('show');
    }, 2600);
  }

  function fmtDate(d) {
    return new Date(d).toLocaleDateString('en-NG', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  }

  function productArt(p) {
    return p.image
      ? `<img
          src="${esc(p.image)}"
          alt="${esc(p.name)}"
          onerror="this.style.display='none';this.nextElementSibling.style.display='grid'"
        ><span class="product-placeholder" style="display:none">OJ.</span>`
      : `<span class="product-placeholder">OJ.</span>`;
  }

  function orderStatus(s) {
    return `<span class="status-tag ${esc(String(s).toLowerCase())}">${esc(s)}</span>`;
  }

  // STORE PAGE
  function renderStore() {
    const grid = document.getElementById('product-grid');
    if (!grid) return;

    const published = db.products.filter(p => p.published);

    const categories = [
      'All',
      ...new Set(published.map(p => p.category))
    ];

    let active = window.activeCategory || 'All';

    if (!categories.includes(active)) {
      active = 'All';
    }

    const filter = document.getElementById('category-filters');

    if (filter) {
      filter.innerHTML = categories.map(c =>
        `<button class="filter-chip ${c === active ? 'selected' : ''}"
          data-category="${esc(c)}">${esc(c)}</button>`
      ).join('');
    }

    const searchInput = document.getElementById('search');
    const q = (searchInput?.value || '').trim().toLowerCase();

    const items = published.filter(p =>
      (active === 'All' || p.category === active) &&
      `${p.name} ${p.category} ${p.description}`
        .toLowerCase()
        .includes(q)
    );

    const total = document.getElementById('product-total');

    if (total) {
      total.textContent =
        `${items.length} ${items.length === 1 ? 'piece' : 'pieces'}`;
    }

    grid.innerHTML = items.map(p => `
      <article class="product-card">
        <div class="product-visual">
          ${productArt(p)}
        </div>

        <div class="product-info">
          <span class="product-category">${esc(p.category)}</span>
          <h3>${esc(p.name)}</h3>

          <div class="product-desc">
            ${esc(p.description)}
          </div>

          <div class="product-bottom">
            <span class="price">${money(p.price)}</span>

            <button
              class="add-button"
              data-add="${esc(p.id)}"
              ${p.stock < 1 ? 'disabled' : ''}
            >
              ${p.stock < 1 ? 'Sold out' : '＋ Add to bag'}
            </button>
          </div>
        </div>
      </article>
    `).join('');

    const empty = document.getElementById('empty-state');

    if (empty) {
      empty.classList.toggle('hidden', items.length > 0);
    }

    renderCart();
  }

  // SHOPPING CART
  function renderCart() {
    const count = db.cart.reduce((a, c) => a + c.qty, 0);

    const el = document.getElementById('cart-count');
    if (!el) return;

    el.textContent = count;

    const drawerCount = document.getElementById('drawer-count');

    if (drawerCount) {
      drawerCount.textContent = `(${count})`;
    }

    const items = document.getElementById('cart-items');
    if (!items) return;

    items.innerHTML = db.cart.map(c => {
      const p = db.products.find(p => p.id === String(c.id));

      if (!p) return '';

      return `
        <div class="cart-row">
          <div>
            <h4>${esc(p.name)}</h4>
            <small>${money(p.price)} each</small>

            <div class="qty-control">
              <button
                data-qty="${esc(p.id)}"
                data-delta="-1"
              >−</button>

              <span>${c.qty}</span>

              <button
                data-qty="${esc(p.id)}"
                data-delta="1"
                ${c.qty >= p.stock ? 'disabled' : ''}
              >＋</button>

              <button
                class="text-button"
                data-remove="${esc(p.id)}"
              >Remove</button>
            </div>
          </div>

          <strong class="price">
            ${money(p.price * c.qty)}
          </strong>
        </div>
      `;
    }).join('') || `
      <div class="empty">
        <span>◇</span>
        <h3>Your bag is empty</h3>
        <p>Add something you love to get started.</p>
      </div>
    `;

    const subtotal = db.cart.reduce((a, c) => {
      const p = db.products.find(p => p.id === String(c.id));
      return a + (p ? p.price * c.qty : 0);
    }, 0);

    const subtotalEl = document.getElementById('cart-subtotal');

    if (subtotalEl) {
      subtotalEl.textContent = money(subtotal);
    }
  }

  function addCart(id) {
    const p = db.products.find(p => p.id === String(id));

    if (!p || p.stock < 1) {
      return toast('This product is currently unavailable.');
    }

    const c = db.cart.find(c => String(c.id) === String(id));

    if (c) {
      if (c.qty >= p.stock) {
        return toast('That is all the available stock.');
      }

      c.qty++;
    } else {
      db.cart.push({
        id: String(id),
        qty: 1
      });
    }

    save();
    renderStore();
    toast('Added to your bag.');
  }

  function openModal(id) {
    document.getElementById(id)?.classList.remove('hidden');
  }

  function closeModal(id) {
    document.getElementById(id)?.classList.add('hidden');
  }

  // ADMIN DASHBOARD
  function renderAdmin() {
    if (!document.getElementById('stat-sales')) return;

    const orders = db.orders;

    const sales = orders
      .filter(o =>
        ['Paid', 'Processing', 'Shipped', 'Delivered'].includes(o.status)
      )
      .reduce((a, o) => a + Number(o.total || 0), 0);

    document.getElementById('stat-sales').textContent = money(sales);
    document.getElementById('stat-orders').textContent = orders.length;
    document.getElementById('stat-products').textContent = db.products.length;

    document.getElementById('stat-low').textContent =
      db.products.filter(p => p.stock <= 5).length;

    document.getElementById('nav-orders').textContent =
      orders.filter(o =>
        !['Delivered', 'Cancelled'].includes(o.status)
      ).length;

    document.getElementById('recent-orders').innerHTML =
      orders.slice().reverse().slice(0, 5).map(o => `
        <div class="order-mini">
          <div>
            <strong>${esc(o.id)} · ${esc(o.name)}</strong>
            <small>
              ${fmtDate(o.date)} ·
              ${o.items.reduce((a, i) => a + i.qty, 0)} item(s)
            </small>
          </div>

          <div style="text-align:right">
            ${orderStatus(o.status)}
            <strong class="price" style="margin-top:5px">
              ${money(o.total)}
            </strong>
          </div>
        </div>
      `).join('') ||
      '<div class="empty-cell">No orders yet. Customer orders will appear here.</div>';

    document.getElementById('stock-overview').innerHTML =
      db.products.slice()
        .sort((a, b) => a.stock - b.stock)
        .slice(0, 5)
        .map(p => `
          <div class="stock-row">
            <div>
              <strong>${esc(p.name)}</strong>
              <small>${esc(p.category)}</small>
            </div>

            <div style="text-align:right">
              <strong class="${p.stock <= 5 ? 'price' : ''}">
                ${p.stock} left
              </strong>
              <small>
                ${p.stock <= 5 ? 'Low stock' : 'In stock'}
              </small>
            </div>
          </div>
        `).join('') ||
      '<div class="empty-cell">No products yet.</div>';

    const search =
      (document.getElementById('admin-product-search')?.value || '')
        .toLowerCase();

    const ps = db.products.filter(p =>
      `${p.name} ${p.category}`.toLowerCase().includes(search)
    );

    document.getElementById('product-count-label').textContent =
      `${ps.length} products`;

    document.getElementById('admin-products').innerHTML =
      ps.map(p => `
        <tr>
          <td>
            <div class="table-product">
              <div class="table-thumb">
                ${p.image
                  ? `<img src="${esc(p.image)}" alt=""
                      style="width:100%;height:100%;object-fit:cover">`
                  : 'OJ.'}
              </div>

              <div>
                <strong>${esc(p.name)}</strong>
                <small>${esc(p.description.slice(0, 48))}</small>
              </div>
            </div>
          </td>

          <td>${esc(p.category)}</td>
          <td>${money(p.price)}</td>
          <td>${p.stock}</td>
          <td>${orderStatus(p.published ? 'Published' : 'Draft')}</td>

          <td>
            <div class="row-actions">
              <button class="mini-button" data-edit="${esc(p.id)}">Edit</button>
              <button class="mini-button danger" data-delete="${esc(p.id)}">Delete</button>
            </div>
          </td>
        </tr>
      `).join('') ||
      '<tr><td colspan="6" class="empty-cell">No products found.</td></tr>';

    document.getElementById('admin-orders').innerHTML =
      orders.slice().reverse().map(o => `
        <tr>
          <td>
            <strong>${esc(o.id)}</strong><br>
            <small class="muted">
              ${o.items.map(i => `${i.qty}× ${esc(i.name)}`).join(', ')}
            </small>
          </td>

          <td>
            ${esc(o.name)}<br>
            <small class="muted">${esc(o.email)}</small>
          </td>

          <td>${fmtDate(o.date)}</td>

          <td>
            ${o.items.reduce((a, i) => a + i.qty, 0)}
          </td>

          <td class="price">${money(o.total)}</td>

          <td>
            <select
              class="order-status-select"
              data-order-status="${esc(o.id)}"
              aria-label="Status for ${esc(o.id)}"
            >
              ${['Pending', 'Paid', 'Processing', 'Shipped', 'Delivered', 'Cancelled']
                .map(s => `
                  <option ${o.status === s ? 'selected' : ''}>${s}</option>
                `).join('')}
            </select>
          </td>
        </tr>
      `).join('') ||
      '<tr><td colspan="6" class="empty-cell">No orders yet. Orders placed through the store will show here.</td></tr>';

    document.getElementById('inventory-cards').innerHTML =
      db.products.map(p => {
        const pct = Math.max(0, Math.min(100, p.stock / 30 * 100));

        return `
          <article class="inventory-card">
            <span class="product-category">${esc(p.category)}</span>
            <h3>${esc(p.name)}</h3>

            <p>
              ${p.stock <= 5
                ? 'Low stock — consider restocking'
                : p.stock + ' units available'}
            </p>

            <div class="inventory-meter">
              <span style="width:${pct}%"></span>
            </div>

            <div class="inventory-meta">
              <span>${p.stock} units</span>
              <button class="text-button" data-edit="${esc(p.id)}">
                Adjust stock / edit →
              </button>
            </div>
          </article>
        `;
      }).join('') ||
      '<div class="empty-cell">No products yet.</div>';
  }

  function setView(v) {
    document.querySelectorAll('.admin-view').forEach(el =>
      el.classList.add('hidden')
    );

    document.getElementById('view-' + v)?.classList.remove('hidden');

    document.querySelectorAll('[data-view]').forEach(b =>
      b.classList.toggle('selected', b.dataset.view === v)
    );

    const title = document.getElementById('view-title');

    if (title) {
      title.textContent = ({
        overview: 'Overview',
        products: 'Products',
        orders: 'Orders',
        inventory: 'Inventory'
      })[v] || 'Overview';
    }
  }

  function productForm(p) {
    const f = document.getElementById('product-form');
    if (!f) return;

    f.reset();

    f.elements.id.value = p?.id || '';
    f.elements.name.value = p?.name || '';
    f.elements.price.value = p?.price ?? '';
    f.elements.stock.value = p?.stock ?? 0;
    f.elements.category.value = p?.category || '';
    f.elements.image.value = p?.image || '';
    f.elements.description.value = p?.description || '';
    f.elements.published.checked = p?.published ?? true;

    document.getElementById('product-modal-title').textContent =
      p ? 'Edit product' : 'Add product';

    openModal('product-modal');
  }

  function initAdmin() {
    document.querySelectorAll('[data-view]').forEach(b => {
      b.addEventListener('click', () => setView(b.dataset.view));
    });

    document.querySelectorAll('[data-action="add-product"]').forEach(b => {
      b.addEventListener('click', () => productForm());
    });

    document.getElementById('product-close').onclick =
      () => closeModal('product-modal');

    document.getElementById('product-form').addEventListener('submit', e => {
      e.preventDefault();

      const f = e.currentTarget;

      const p = {
        id: f.elements.id.value || 'p' + Date.now(),
        name: f.elements.name.value.trim(),
        price: Number(f.elements.price.value),
        stock: Number(f.elements.stock.value),
        category: f.elements.category.value.trim(),
        image: f.elements.image.value.trim(),
        description: f.elements.description.value.trim(),
        published: f.elements.published.checked
      };

      const i = db.products.findIndex(x => x.id === p.id);

      if (i >= 0) {
        db.products[i] = p;
      } else {
        db.products.push(p);
      }

      save();
      closeModal('product-modal');
      renderAdmin();

      toast(i >= 0
        ? 'Product updated in this browser.'
        : 'Product added in this browser.');
    });

    document.getElementById('admin-product-search')
      .addEventListener('input', renderAdmin);

    document.getElementById('admin-products')
      .addEventListener('click', e => {
        const edit = e.target.closest('[data-edit]');
        const del = e.target.closest('[data-delete]');

        if (edit) {
          const p = db.products.find(p => p.id === edit.dataset.edit);
          if (p) productForm(p);
        }

        if (del) {
          const p = db.products.find(p => p.id === del.dataset.delete);
          if (!p) return;

          if (!confirm(`Delete "${p.name}" from this browser?`)) return;

          db.products = db.products.filter(x => x.id !== p.id);
          db.cart = db.cart.filter(x => x.id !== p.id);

          save();
          renderAdmin();
          toast('Product deleted from this browser.');
        }
      });

    document.getElementById('admin-orders')
      .addEventListener('change', e => {
        const id = e.target.dataset.orderStatus;
        if (!id) return;

        const o = db.orders.find(o => o.id === id);

        if (o) {
          o.status = e.target.value;
          save();
          renderAdmin();
          toast('Order status updated in this browser.');
        }
      });

    renderAdmin();
  }

  // STORE PAGE INITIALIZATION
  if (document.body.dataset.page === 'store') {
    const year = document.getElementById('year');

    if (year) {
      year.textContent = new Date().getFullYear();
    }

    renderStore();

    document.getElementById('search')
      .addEventListener('input', renderStore);

    document.getElementById('category-filters')
      .addEventListener('click', e => {
        const b = e.target.closest('[data-category]');

        if (b) {
          window.activeCategory = b.dataset.category;
          renderStore();
        }
      });

    document.getElementById('product-grid')
      .addEventListener('click', e => {
        const b = e.target.closest('[data-add]');

        if (b) {
          addCart(b.dataset.add);
        }
      });

    document.getElementById('cart-open').onclick =
      () => openModal('cart-overlay');

    document.getElementById('cart-close').onclick =
      () => closeModal('cart-overlay');

    document.getElementById('cart-overlay')
      .addEventListener('click', e => {
        if (e.target.id === 'cart-overlay') {
          closeModal('cart-overlay');
        }
      });

    document.getElementById('cart-items')
      .addEventListener('click', e => {
        const q = e.target.closest('[data-qty]');
        const r = e.target.closest('[data-remove]');

        if (q) {
          const c = db.cart.find(c =>
            String(c.id) === String(q.dataset.qty)
          );

          const p = db.products.find(p =>
            String(p.id) === String(q.dataset.qty)
          );

          if (c && p) {
            c.qty = Math.max(
              0,
              Math.min(
                p.stock,
                c.qty + Number(q.dataset.delta)
              )
            );

            if (!c.qty) {
              db.cart = db.cart.filter(x => x.id !== c.id);
            }

            save();
            renderCart();
          }
        }

        if (r) {
          db.cart = db.cart.filter(c =>
            String(c.id) !== String(r.dataset.remove)
          );

          save();
          renderCart();
        }
      });

    document.getElementById('checkout').onclick = () => {
      if (!db.cart.length) {
        return toast('Your bag is empty.');
      }

      closeModal('cart-overlay');
      openModal('checkout-modal');
    };

    document.getElementById('checkout-close').onclick =
      () => closeModal('checkout-modal');

    document.getElementById('checkout-form')
      .addEventListener('submit', e => {
        e.preventDefault();

        const f = e.currentTarget;

        for (const c of db.cart) {
          const p = db.products.find(p =>
            String(p.id) === String(c.id)
          );

          if (!p || p.stock < c.qty) {
            return toast('Stock changed. Please review your bag.');
          }
        }

        const items = db.cart.map(c => {
          const p = db.products.find(p =>
            String(p.id) === String(c.id)
          );

          return {
            id: p.id,
            name: p.name,
            price: p.price,
            qty: c.qty
          };
        });

        const total = items.reduce(
          (a, i) => a + i.price * i.qty,
          0
        );

        db.orders.push({
          id: 'OJ-' + Date.now().toString().slice(-7),
          name: f.elements.name.value.trim(),
          email: f.elements.email.value.trim(),
          phone: f.elements.phone.value.trim(),
          address: f.elements.address.value.trim(),
          date: new Date().toISOString(),
          items,
          total,
          status: 'Pending'
        });

        items.forEach(i => {
          const p = db.products.find(p =>
            String(p.id) === String(i.id)
          );

          if (p) p.stock -= i.qty;
        });

        db.cart = [];

        save();
        closeModal('checkout-modal');
        f.reset();
        renderStore();

        toast('Demo order placed! The admin dashboard has been updated.');
      });

    window.addEventListener('storage', e => {
      if (e.key === KEY) {
        db = getDB();
        renderStore();
      }
    });
  } else {
    initAdmin();

    window.addEventListener('storage', e => {
      if (e.key === KEY) {
        db = getDB();
        renderAdmin();
      }
    });
  }

  window.addEventListener('ojcrest-update', () => {
    db = getDB();

    if (document.body.dataset.page === 'admin') {
      renderAdmin();
    } else {
      renderStore();
    }
  });

  // Load the Supabase products after the page is initialized.
  loadProductsFromSupabase();

})();
