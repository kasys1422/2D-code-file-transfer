const fileInput = document.getElementById('fileInput');
const sendButton = document.getElementById('sendButton');
const qrCodeCanvas = document.getElementById('qrCodeCanvas');
const qrCodeContainer = document.getElementById('qrCodeContainer');

const cameraInput = document.getElementById('cameraInput');
const startCameraButton = document.getElementById('startCameraButton');
const video = document.getElementById('video');
const progress = document.getElementById('progress');
const downloadLink = document.getElementById('downloadLink');
const downloadLinkContainer = document.getElementById('downloadLinkContainer');

let chunks = {};
let numberOfChunks = null;
let chunkSize;
let binaryData;
let firstFlag = true;
fileInput.addEventListener('change', async (event) => {
  const file = event.target.files[0];
  const reader = new FileReader();

  reader.onload = async (event) => {
    const fileData = new Uint8Array(event.target.result);
    const fileName = new TextEncoder().encode(file.name);
    binaryData = new Uint8Array(4 + fileName.length + fileData.length);

    binaryData.set(new Uint8Array([fileName.length]));
    binaryData.set(fileName, 2);
    binaryData.set(fileData, 2 + fileName.length);

    chunkSize = 100;

    const numberOfChunks = Math.ceil(binaryData.length / chunkSize);
    binaryData.set(new Uint8Array(new Uint16Array([numberOfChunks]).buffer), 2 + fileName.length + fileData.length);
    
    if(firstFlag == true){
      displayNextQRCode();
      qrCodeContainer.style.display = 'flex';
      qrCodeContainer.style.justifyContent = 'center';
      firstFlag = false;
    }
  };

  reader.readAsArrayBuffer(file);
});


async function displayNextQRCode() {
    while (true) { // forループをwhileループに変更
      for (let i = 0; i < binaryData.length; i += chunkSize) {
        const chunk = binaryData.slice(i, i + chunkSize);
        const compressedChunk = pako.deflate(chunk);
        const qrCodeData = {
          index: i / chunkSize,
          data: Array.from(compressedChunk),
          totalChunks: Math.ceil(binaryData.length / chunkSize),
          chunkSize: chunkSize,
        };
  
        const qrCodeOptions = {
          scale: 8, // 1つのQRコードモジュールの画素数を指定（数値を変更して調整できます）
          width: 300, // QRコードの幅を指定
          height: 300, // QRコードの高さを指定
        };
      
        await new Promise((resolve) => {
          QRCode.toCanvas(qrCodeCanvas, JSON.stringify(qrCodeData), qrCodeOptions, () => {
            setTimeout(resolve, 200);
          });
        });
      }
    }
  }

  function isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }

startCameraButton.addEventListener('click', async () => {
  video.style.display = 'block';
  if (isMobile()) {
    const videoConstraints = {
      facingMode: 'environment', // スマートフォンの背面カメラを使用
    };
    const stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints });
    video.srcObject = stream;
  } else {
    
    const cameras = await navigator.mediaDevices.enumerateDevices();
    const selectedDevice = cameras.find((device) => device.kind === 'videoinput' && device.deviceId === cameraInput.value);
    const constraints = {
      video: { deviceId: selectedDevice.deviceId},
    };
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    video.srcObject = stream;
  }
  decodeQRCode(video);
});

function updateProgress(currentChunk, totalChunks) {
  const progressPercentageElement = document.getElementById("progressPercentage");
  const remainingChunksElement = document.getElementById("remainingChunks");

  const percentage = Math.round((currentChunk / totalChunks) * 100);
  progress.style.width = percentage + "%";
  progress.textContent = percentage + "%";

  progressPercentageElement.textContent = `Progress: ${percentage}%`;
  remainingChunksElement.textContent = `Remaining chunks: ${Math.trunc(totalChunks - currentChunk)}`;
}

async function decodeQRCode(videoElement) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
  
    while (true) {
      if (videoElement.videoWidth > 0 && videoElement.videoHeight > 0) {
        canvas.width = videoElement.videoWidth;
        canvas.height = videoElement.videoHeight;
        context.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
        try {
          const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height);


          if (code) {
              const { index, data, totalChunks, chunkSize } = JSON.parse(code.data); // chunkSizeを取得
              const compressedChunk = new Uint8Array(data);
              const decompressedChunk = pako.inflate(compressedChunk);
              chunks[index] = decompressedChunk;
          
              numberOfChunks = totalChunks;
              let fileChunkSize = chunkSize; // この変数を使ってQRコードデータの復号化を行います

              if (numberOfChunks) {
                  progress.value = (Object.keys(chunks).length / numberOfChunks) * 100;
                  updateProgress(progress.value * numberOfChunks /100, numberOfChunks);
              }

              if (Object.keys(chunks).length === numberOfChunks) {
                  const fileData = new Uint8Array(binaryDataLength(chunks));
                  Object.entries(chunks).forEach(([index, chunk]) => {
                  const start = index * fileChunkSize;
                  fileData.set(chunk, start);
                  });

                  const fileNameLength = new Uint8Array(fileData.slice(0, 2))[0];
                  const fileName = new TextDecoder().decode(fileData.slice(2, 2 + fileNameLength));
                  const fileContent = fileData.slice(2 + fileNameLength, -2);

                  const blob = new Blob([fileContent]);
                  const url = URL.createObjectURL(blob);
                  downloadLink.href = url;
                  downloadLink.download = fileName;
                  downloadLinkContainer.style.display = 'block';
              }
          }
        } catch (error) {
          if(error.message != "Unexpected end of JSON input"){
            alert("Error getting image data: " + error.message);
            console.error("Error getting image data:", error);
          }
        }
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
    }
}

async function loadCameras() {
  const cameras = await navigator.mediaDevices.enumerateDevices();
  const videoDevices = cameras.filter((device) => device.kind === 'videoinput');
  videoDevices.forEach((device) => {
    const option = document.createElement('option');
    option.value = device.deviceId;
    option.textContent = device.label;
    cameraInput.appendChild(option);
  });
}

if (!isMobile()) {
  loadCameras();
}

function binaryDataLength(chunks) {
  return Object.values(chunks).reduce((total, chunk) => total + chunk.length, 0);
}

const refreshButton = document.getElementById("refreshButton");

refreshButton.addEventListener("click", () => {
  resetDecodeState();
});

function resetDecodeState() {
  // 変数と表示をリセット
  chunks = {};
  numberOfChunks = null;
  fileChunkSize = null;
  receivedFile = null;
  progress.style.width = "0%";
  progress.textContent = "";
  progress.value = 0;
  document.getElementById("progressPercentage").textContent = "";
  document.getElementById("remainingChunks").textContent = "";
}
