
document.addEventListener('DOMContentLoaded', function() {
	loadCartFromStorage();
	renderCart();
	setupCamera();
	setupPaymentButtons();
});

function simulateAIProductRecognition() {

	const predictionGrid = document.getElementById('predictionGrid');
	
	const mockDetections = [
		{ name: 'นมสด', confidence: 0.95, price: 25.00 },
		{ name: 'ชาเขียว', confidence: 0.87, price: 30.00 },
		{ name: 'กาแฟดำ', confidence: 0.78, price: 35.00 }
	];
	
	predictionGrid.innerHTML = mockDetections.map(item => `
		<div class="prediction-card" onclick="addDetectedProduct('${item.name}', ${item.price})">
			<div class="prediction-name">${item.name}</div>
			<div class="prediction-confidence">ความมั่นใจ: ${Math.round(item.confidence * 100)}%</div>
			<div class="prediction-price">฿${item.price.toFixed(2)}</div>
		</div>
	`).join('');
}

function addDetectedProduct(name, price) {
	const product = products.find(p => p.name === name);
	if (product) {
		addToCart(product, 1);
		alert(`เพิ่ม ${name} ลงในตะกร้าแล้ว`);
	} else {
		alert(`ไม่พบสินค้า ${name} ในระบบ`);
	}
}

function setupPaymentButtons() {
	const cashBtn = document.querySelector('.cash-btn');
	const scanBtn = document.querySelector('.scan-btn');
	const cashInput = document.getElementById('cashInput');
	
	cashBtn.addEventListener('click', () => {
		handleCashPayment();
	});
	
	scanBtn.addEventListener('click', () => {
		handleQRPayment();
	});
	
	cashInput.addEventListener('input', (e) => {
		const cashAmount = parseFloat(e.target.value) || 0;
		const total = [...cart.values()].reduce((s, {product, qty}) => s + product.price * qty, 0);
		
		if (cashAmount >= total) {
			cashBtn.style.backgroundColor = '#10b981';
			cashBtn.textContent = `เงินทอน: ฿${(cashAmount - total).toFixed(2)}`;
		} else {
			cashBtn.style.backgroundColor = '#6b7280';
			cashBtn.textContent = 'เงินสด';
		}
	});
}

function handleCashPayment() {
	const cashInput = document.getElementById('cashInput');
	const cashAmount = parseFloat(cashInput.value) || 0;
	const total = [...cart.values()].reduce((s, {product, qty}) => s + product.price * qty, 0);
	
	if (cashAmount < total) {
		alert(`เงินสดไม่เพียงพอ ต้องการ ฿${total.toFixed(2)} แต่ได้รับ ฿${cashAmount.toFixed(2)}`);
		return;
	}
	
	const change = cashAmount - total;
	alert(`รับเงินสด ฿${cashAmount.toFixed(2)}\nรวม ฿${total.toFixed(2)}\nเงินทอน ฿${change.toFixed(2)}`);
	
	processPayment('cash');
}

function handleQRPayment() {
	const total = [...cart.values()].reduce((s, {product, qty}) => s + product.price * qty, 0);
	alert(`ชำระด้วย QR Code\nรวม ฿${total.toFixed(2)}`);
	
	processPayment('qrcode');
}

async function processPayment(paymentMethod) {
	if (cart.size === 0) { 
		alert("ไม่มีสินค้าในตะกร้า"); 
		return; 
	}
	
	const total = [...cart.values()].reduce((s, {product, qty}) => s + product.price * qty, 0);
	
	const checkoutBtn = document.getElementById('checkoutBtn');
	checkoutBtn.disabled = true;
	checkoutBtn.textContent = 'กำลังประมวลผล...';
	
	try {
		if (typeof decrementStockForCheckout === 'function') {
			decrementStockForCheckout();
		}

		if (paymentMethod === 'qrcode') {
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
}

let cameraStream = null;
let videoElement = null;

async function startCamera() {
  try {
    videoElement = document.createElement("video");
    videoElement.setAttribute("autoplay", "");
    videoElement.setAttribute("playsinline", "");
    videoElement.style.width = "100%";
    videoElement.style.height = "100%";
    videoElement.style.objectFit = "cover";

    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" }
    });

    videoElement.srcObject = cameraStream;

    const cameraDisplay = document.getElementById("cameraDisplay");
    cameraDisplay.innerHTML = "";
    cameraDisplay.appendChild(videoElement);
  } catch (err) {
    console.error("Camera access error:", err);
    alert("ไม่สามารถเข้าถึงกล้องได้ กรุณาอนุญาตการใช้งานกล้อง");
  }
}


function takeSnapshot() {
  if (!videoElement) {
    alert("กรุณาเปิดกล้องก่อน");
    return;
  }

  const canvas = document.createElement("canvas");
  canvas.width = videoElement.videoWidth;
  canvas.height = videoElement.videoHeight;

  const ctx = canvas.getContext("2d");
  ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

  const imageData = canvas.toDataURL("image/png");

  const cameraDisplay = document.getElementById("cameraDisplay");
  cameraDisplay.innerHTML = `<img src="${imageData}" alt="Captured snapshot" style="width: 100%; height: 100%; object-fit: cover;">`;


  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
  }


  simulateAIProductRecognition();
}

function setupCamera() {
  const cameraDisplay = document.getElementById('cameraDisplay');
  const captureBtn = document.getElementById('captureBtn');

  cameraDisplay.addEventListener('click', () => {
    startCamera();
  });

  captureBtn.addEventListener('click', () => {
    takeSnapshot();
  });
}


