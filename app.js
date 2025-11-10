
let products = [];
let categories = new Set();


let activeCategories = new Set();
let cart = new Map();

function saveCartToStorage() {
	const cartData = Array.from(cart.entries()).map(([id, item]) => ({
		id: id,
		product: item.product,
		qty: item.qty
	}));
	localStorage.setItem('pos_cart', JSON.stringify(cartData));
}

function loadCartFromStorage() {
	try {
		const cartData = localStorage.getItem('pos_cart');
		if (cartData) {
			const parsed = JSON.parse(cartData);
			cart.clear();
			parsed.forEach(item => {
				cart.set(item.id, { product: item.product, qty: item.qty });
			});
		}
	} catch (error) {
		console.error('Error loading cart from storage:', error);
		cart.clear();
	}
}

const gridEl = document.getElementById("productGrid");
const searchEl = document.getElementById("search");
const categoryListEl = document.getElementById("categoryList");
const cartItemsEl = document.getElementById("cartItems");
const cartTotalEl = document.getElementById("cartTotal");
const checkoutBtn = document.getElementById("checkoutBtn");

function getProductOverrides() {
	try {
		const raw = localStorage.getItem('pos_products_override');
		return raw ? JSON.parse(raw) : {};
	} catch {
		return {};
	}
}

function saveProductOverrides(overrides) {
	try {
		localStorage.setItem('pos_products_override', JSON.stringify(overrides));
	} catch {}
}

function applyProductOverrides() {
	const overrides = getProductOverrides();
	if (!products || products.length === 0) return;
	products = products.map(p => {
		const ov = overrides[p.id];
		if (!ov) return p;
		return { ...p, ...ov };
	});
}

function decrementStockForCheckout() {
	const overrides = getProductOverrides();
	for (const { product, qty } of cart.values()) {
		const current = products.find(pr => pr.id === product.id);
		if (!current) continue;
		const nextStock = Math.max(0, (current.stock || 0) - qty);
		overrides[product.id] = { ...(overrides[product.id] || {}), stock: nextStock };
	}
	saveProductOverrides(overrides);
	applyProductOverrides();
}

async function loadProducts() {
	try {
		if (typeof location !== 'undefined' && location.protocol === 'file:') {
		const baked = (typeof window !== 'undefined' ? window.PRODUCT_DATA : undefined);
		let dataset = [];
		if (Array.isArray(baked)) {
			const tableNode = baked.find(n => n && n.type === 'table' && n.name === 'product-list' && Array.isArray(n.data));
			if (tableNode) {
				dataset = tableNode.data;
			} else {
				dataset = baked;
			}
		} else if (baked && Array.isArray(baked.data)) {
			dataset = baked.data;
		}

		if (!Array.isArray(dataset) || dataset.length === 0) {
			throw new Error('No product data found in window.PRODUCT_DATA. Ensure product-data.js is included before app.js.');
		}

		products = (dataset || []).map(normalizeProduct);
			applyProductOverrides();

			categories = new Set(products.map(p => p.category));
			activeCategories = new Set(categories);
			updateCategoryList();
			renderProducts();
			return;
		}

		let response = await fetch('product-list.json', { cache: 'no-store' });

		if (!response.ok) {
			throw new Error('product-list.json not found');
		}
		
		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}
		
		const result = await response.json();
		
		let loaded = [];
		if (Array.isArray(result)) {
			const tableNode = result.find(n => n && n.type === 'table' && n.name === 'product-list' && Array.isArray(n.data));
			if (tableNode) {
				loaded = tableNode.data;
			} else {
				loaded = result;
			}
		} else if (result && Array.isArray(result.data)) {
			loaded = result.data;
		}

		products = (loaded || []).map(normalizeProduct);

		applyProductOverrides();
		
		categories = new Set(products.map(p => p.category));
		activeCategories = new Set(categories);
		
		updateCategoryList();
		
		renderProducts();
	} catch (error) {
		console.error('Error loading products:', error);
		let errorMessage = 'ไม่สามารถโหลดข้อมูลสินค้าได้';
		if (typeof location !== 'undefined' && location.protocol === 'file:') {
			errorMessage += '<br><small>ไม่สามารถโหลดไฟล์ JSON ผ่าน file:// ได้ กรุณาเปิดผ่านเว็บเซิร์ฟเวอร์ เช่นใช้คำสั่งง่ายๆ npx serve หรือ python -m http.server</small>';
		}
		gridEl.innerHTML = `<div class="error-message">${errorMessage}</div>`;
	}
}

function normalizeProduct(p) {
	const id = p.id ?? p.ID ?? String(p.index ?? p.Index ?? p.name ?? p.Name ?? Math.random().toString(36).slice(2));
	const name = p.name ?? p.Name ?? '';
	const price = Number(p.price ?? p.Price ?? 0);
	const shelfStock = Number(p.shelfStock ?? p['Shelf Quantity'] ?? 0);
	const warehouseStock = Number(p.warehouseStock ?? p['Warehouse Quantity'] ?? 0);
	const stock = Number(p.stock ?? (shelfStock + warehouseStock));
	const category = p.category ?? p.Category ?? 'Other';
	let image = p.image ?? p.Picture ?? '';

	if (image && typeof image === 'string') {
		if ((image.startsWith('"') && image.endsWith('"')) || (image.startsWith("'") && image.endsWith("'"))) {
			image = image.slice(1, -1);
		}
		const webish = image.replace(/\\/g, '/');
		const idx = webish.toLowerCase().indexOf('images/');
		if (idx !== -1) {
			image = webish.slice(idx);
		}
	}

	if (!image && name) {
		image = `images/${name}.jpg`;
	}

	return {
		id,
		name,
		price,
		stock,
		shelfStock,
		warehouseStock,
		category,
		image,
		index: Number(p.index ?? p.Index ?? 0)
	};
}

function updateCategoryList() {
	const allCategoryItem = categoryListEl.querySelector('li');
	
	categoryListEl.innerHTML = '';
	categoryListEl.appendChild(allCategoryItem);
	
	categories.forEach(category => {
		const li = document.createElement('li');
		li.innerHTML = `
			<label class="category-item">
				<input type="checkbox" value="${category}" checked>
				<span>${getCategoryDisplayName(category)}</span>
			</label>
		`;
		categoryListEl.appendChild(li);
	});
}

function getCategoryDisplayName(category) {
	const categoryMap = {
		'Milk': 'นม',
		'Tea': 'ชา', 
		'Coffee': 'กาแฟ',
		'Fruit': 'ผลไม้',
		'Soft Drinks': 'น้ำหวาน',
		'Packaging': 'กล่อง'
	};
	return categoryMap[category] || category;
}

function renderProducts() {
	const q = searchEl.value.trim().toLowerCase();
	const filtered = products.filter(p => activeCategories.has(p.category) && (!q || p.name.toLowerCase().includes(q)));
	gridEl.innerHTML = filtered.map(p => productCardHTML(p)).join("");
}

function productCardHTML(p) {
	let imageSrc = p.image;
	
	if (imageSrc && !imageSrc.match(/^(https?:\/\/|\/)/)) {
		if (!imageSrc.includes('/')) {
			imageSrc = `images/${imageSrc}`;
		}
	}
	
	const fallbackImage = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300"><rect width="300" height="300" fill="%23f1f5f9"/></svg>';
	
	return `
		<div class="product-card" data-id="${p.id}">
			<img class="product-img" src="${imageSrc}" alt="${p.name}" onerror="this.src='${fallbackImage}'">
			<div class="product-name">${p.name}</div>
			<div class="product-meta"><span>฿${p.price.toFixed(2)}</span><span>สต็อก: ${p.stock}</span></div>
			<div class="product-actions">
				<button class="btn add-to-cart">ใส่ตะกร้า</button>
			</div>
		</div>
	`;
}

categoryListEl.addEventListener("change", (e) => {
	const input = e.target;
	if (input.tagName !== "INPUT") return;
	if (input.id === "cat-all") {
		const checked = input.checked;
		[...categoryListEl.querySelectorAll('input[type="checkbox"]')].forEach(cb => { if (cb !== input) cb.checked = checked; });
		activeCategories = checked ? new Set(categories) : new Set();
	} else {
		if (input.checked) activeCategories.add(input.value); else activeCategories.delete(input.value);
		const allChecked = [...categoryListEl.querySelectorAll('input[type="checkbox"]')].filter(cb => cb.id !== "cat-all").every(cb => cb.checked);
		categoryListEl.querySelector('#cat-all').checked = allChecked;
	}
	renderProducts();
});

searchEl.addEventListener("input", renderProducts);

gridEl.addEventListener("click", (e) => {
	const btn = e.target.closest(".add-to-cart");
	if (!btn) return;
	const card = e.target.closest(".product-card");
	const id = card.dataset.id;
	const prod = products.find(p => p.id === id);
	addToCart(prod, 1);
});

function addToCart(product, qty) {
	const item = cart.get(product.id) || { product, qty: 0 };
	const newQty = item.qty + qty;
	
	if (newQty > product.stock) {
		alert(`ไม่สามารถเพิ่มสินค้าได้ เนื่องจากสต็อกคงเหลือเพียง ${product.stock} ชิ้น`);
		return;
	}
	
	item.qty = Math.max(0, newQty);
	if (item.qty <= 0) cart.delete(product.id); else cart.set(product.id, item);
	
	saveCartToStorage();
	renderCart();
}

function renderCart() {
	cartItemsEl.innerHTML = [...cart.values()].map(({product, qty}) => cartItemHTML(product, qty)).join("");
	const total = [...cart.values()].reduce((s, {product, qty}) => s + product.price * qty, 0);
	cartTotalEl.textContent = `฿${total.toFixed(2)}`;
}

function cartItemHTML(p, qty) {
	return `
		<div class="cart-item" data-id="${p.id}">
			<div>
				<div class="cart-item-title">${p.name}</div>
				<div class="product-meta">฿${p.price.toFixed(2)}</div>
			</div>
			<div class="cart-item-controls">
				<div class="qty">
					<button class="qty-dec" aria-label="decrease">−</button>
					<input type="text" class="qty-input" value="${qty}" inputmode="numeric">
					<button class="qty-inc" aria-label="increase">+</button>
				</div>
				<button class="btn remove">ลบ</button>
			</div>
		</div>
	`;
}

cartItemsEl.addEventListener("click", (e) => {
	const root = e.target.closest('.cart-item');
	if (!root) return;
	const id = root.dataset.id;
	const item = cart.get(id);
	if (!item) return;
	if (e.target.classList.contains('qty-inc')) addToCart(item.product, 1);
	if (e.target.classList.contains('qty-dec')) addToCart(item.product, -1);
	if (e.target.classList.contains('remove')) { 
		cart.delete(id); 
		saveCartToStorage();
		renderCart(); 
	}
});

cartItemsEl.addEventListener("input", (e) => {
	const input = e.target.closest('.qty-input');
	if (!input) return;
	const root = e.target.closest('.cart-item');
	const id = root.dataset.id;
	const item = cart.get(id);
	if (!item) return;
	let next = parseInt(input.value.replace(/\D/g, ''), 10);
	if (Number.isNaN(next)) next = 0;
	
	if (next > item.product.stock) {
		alert(`ไม่สามารถเพิ่มจำนวนได้ เนื่องจากสต็อกคงเหลือเพียง ${item.product.stock} ชิ้น`);
		next = item.product.stock;
		input.value = next;
	}
	
	next = Math.max(0, next);
	if (next === 0) cart.delete(id); else { item.qty = next; cart.set(id, item); }
	saveCartToStorage();
	renderCart();
});

checkoutBtn.addEventListener("click", async () => {
	if (cart.size === 0) { 
		alert("ไม่มีสินค้าในตะกร้า"); 
		return; 
	}
	
	const payment = document.querySelector('input[name="payment"]:checked').value;
	const total = [...cart.values()].reduce((s, {product, qty}) => s + product.price * qty, 0);
	
	checkoutBtn.disabled = true;
	checkoutBtn.textContent = 'กำลังประมวลผล...';
	
	try {
		decrementStockForCheckout();

		if (payment === 'qrcode') {
			alert(`ชำระด้วย QR รวม ${total.toFixed(2)} บาท\n\nสต็อกได้รับการอัปเดตแล้ว (ภายในเครื่อง)`);
		} else {
			alert(`รับเงินสด รวม ${total.toFixed(2)} บาท\n\nสต็อกได้รับการอัปเดตแล้ว (ภายในเครื่อง)`);
		}

		cart.clear();
		saveCartToStorage();
		renderCart();
		await loadProducts();
		
	} catch (error) {
		console.error('Checkout error:', error);
		alert('เกิดข้อผิดพลาดในการชำระเงิน กรุณาลองใหม่อีกครั้ง');
	} finally {
		checkoutBtn.disabled = false;
		checkoutBtn.textContent = 'ชำระเงิน';
	}
});

loadCartFromStorage();
loadProducts();
renderCart();