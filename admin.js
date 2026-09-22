const apiBase = localStorage.getItem('shopnest-api') || 'http://localhost:4000';
const productForm = document.querySelector('#productForm');
const productList = document.querySelector('#products');
const statusText = document.querySelector('#status');
const upiPanel = document.createElement('section');
upiPanel.className = 'admin-panel';
upiPanel.innerHTML = '<h2>UPI checkout</h2><p class="admin-help">Upload the QR customers should scan and enter the UPI ID shown in your payment app.</p><form class="admin-form" id="upiForm"><input name="adminKey" type="password" placeholder="Admin key" required><input name="upiId" placeholder="yourname@upi" required><input name="qr" type="file" accept="image/*" required><button class="primary-button" type="submit">Save payment QR <span>→</span></button><p class="status" id="upiStatus"></p></form>';
document.querySelector('.admin-grid').prepend(upiPanel);
const upiForm = upiPanel.querySelector('#upiForm');
const upiStatus = upiPanel.querySelector('#upiStatus');
const asDataUrl = (file) => new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); });
async function loadProducts() {
  try {
    const response = await fetch(`${apiBase}/api/products`);
    const { products } = await response.json();
    productList.innerHTML = `<table class="admin-table"><tr><th>Product</th><th>Price</th><th>Stock</th><th></th></tr>${products.map((product) => `<tr><td><img src="${product.image}" alt="">${product.name}</td><td>₹${product.price.toLocaleString('en-IN')}</td><td>${product.stock}</td><td><button class="danger" data-delete="${product.id}">Delete</button></td></tr>`).join('')}</table>`;
  } catch { productList.textContent = 'Start the backend to load products.'; }
}
productForm.addEventListener('submit', async (event) => {
  event.preventDefault(); statusText.textContent = 'Saving…';
  const form = new FormData(event.currentTarget); const photos = [...form.get('photos')].slice(0, 4);
  if (!photos.length) { statusText.textContent = 'Choose at least one photo.'; return; }
  try {
    const images = await Promise.all(photos.map(asDataUrl));
    const response = await fetch(`${apiBase}/api/admin/products`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-key': form.get('adminKey') }, body: JSON.stringify({ id: Number(form.get('id')), name: form.get('name'), category: form.get('category'), price: Number(form.get('price')), stock: Number(form.get('stock')), image: images[0], images }) });
    const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Could not save product');
    statusText.textContent = 'Product saved.'; event.currentTarget.reset(); loadProducts();
  } catch (error) { statusText.textContent = error.message; }
});
productList.addEventListener('click', async (event) => { const id = event.target.dataset.delete; if (!id || !confirm('Remove this product from the store?')) return; const key = prompt('Enter admin key'); if (!key) return; const response = await fetch(`${apiBase}/api/admin/products/${id}`, { method: 'DELETE', headers: { 'x-admin-key': key } }); statusText.textContent = response.ok ? 'Product removed.' : 'Could not remove product.'; loadProducts(); });
upiForm.addEventListener('submit', async (event) => { event.preventDefault(); const form = new FormData(event.currentTarget); const file = form.get('qr'); if (!file?.size) return; upiStatus.textContent = 'Saving…'; try { const qr = await asDataUrl(file); const response = await fetch(`${apiBase}/api/admin/store-settings`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'x-admin-key': form.get('adminKey') }, body: JSON.stringify({ upi_id: form.get('upiId'), upi_qr: qr }) }); const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Could not save QR'); upiStatus.textContent = 'Payment QR saved.'; event.currentTarget.reset(); } catch (error) { upiStatus.textContent = error.message; } });
loadProducts();
