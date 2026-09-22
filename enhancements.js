const productModal = document.querySelector('#productModal');
const checkoutModal = document.querySelector('#checkoutModal');
const productDetail = document.querySelector('#productDetail');
const overlay = document.querySelector('#overlay');
const galleryProducts = products.map((product) => ({
  ...product,
  images: product.images || [product.image]
}));
const apiBase = localStorage.getItem('shopnest-api') || 'http://localhost:4000';
async function loadUpiSettings() {
  try {
    const response = await fetch(`${apiBase}/api/store-settings`);
    const settings = await response.json();
    if (settings.upi_qr && settings.upi_id) {
      document.querySelector('#upiQr').src = settings.upi_qr;
      document.querySelector('#upiId').textContent = settings.upi_id;
      document.querySelector('#upiPayment').hidden = false;
    }
  } catch { /* Static storefront remains usable when the API is offline. */ }
}
loadUpiSettings();

function openCustomerModal(modal) {
  overlay.hidden = false;
  modal.hidden = false;
}
function closeCustomerModal(modal) {
  modal.hidden = true;
  if (document.querySelector('.drawer.open') === null) overlay.hidden = true;
}
function showProductDetail(product) {
  const images = product.images.length ? product.images : [product.image];
  productDetail.innerHTML = `<div class="product-detail"><div class="detail-gallery">${images.slice(0, 4).map((image) => `<img src="${image}" alt="${product.name}">`).join('')}</div><div><p class="eyebrow">${product.category}</p><h2>${product.name}</h2><p class="detail-price">${money(product.price)}</p><p class="detail-copy">Thoughtfully selected for everyday living. Add this piece to your bag and make it part of your next good day.</p><button class="primary-button full-button detail-add" data-detail-id="${product.id}">Add to bag <span>→</span></button></div></div>`;
  openCustomerModal(productModal);
}

grid.addEventListener('click', (event) => {
  if (event.target.closest('.heart, .add-to-bag')) return;
  const card = event.target.closest('.product-card');
  if (!card) return;
  const productName = card.querySelector('h3')?.textContent;
  const product = galleryProducts.find((item) => item.name === productName);
  if (product) showProductDetail(product);
});

document.addEventListener('click', (event) => {
  const detailAdd = event.target.closest('.detail-add');
  if (detailAdd) {
    const product = galleryProducts.find((item) => item.id === Number(detailAdd.dataset.detailId));
    if (product) {
      const existing = cart.find((item) => item.id === product.id && !item.liked);
      if (existing) existing.qty = (existing.qty || 1) + 1;
      else cart.push({ ...product, qty: 1 });
      save();
      closeCustomerModal(productModal);
      showToast('Added to your bag');
    }
  }
  const close = event.target.closest('[data-close="productModal"], [data-close="checkoutModal"]');
  if (close) closeCustomerModal(close.dataset.close === 'productModal' ? productModal : checkoutModal);
});

document.querySelector('#checkoutButton').addEventListener('click', () => {
  if (!cart.some((item) => !item.liked)) return showToast('Your bag is empty');
  closePanel('bagDrawer');
  openCustomerModal(checkoutModal);
});

document.querySelector('#checkoutForm').addEventListener('submit', (event) => {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const pincode = String(formData.get('pincode')).replace(/\D/g, '');
  if (pincode.length !== 6) return showToast('Please enter a valid pincode');
  if (!document.querySelector('#upiPayment').hidden && String(formData.get('utr') || '').trim().length < 6) return showToast('Enter your UPI payment reference');
  closeCustomerModal(checkoutModal);
  showToast('Order request received. We will confirm your payment shortly.');
  event.currentTarget.reset();
});
