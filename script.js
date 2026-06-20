pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

const fileInput = document.getElementById("pdfFiles");
const pageList = document.getElementById("pageList");
const statusText = document.getElementById("status");
const downloadBtn = document.getElementById("downloadBtn");
const resetBtn = document.getElementById("resetBtn");

let pageItems = [];
let fileBuffers = [];

new Sortable(pageList, {
  animation: 180
});

fileInput.addEventListener("change", handleFiles);
downloadBtn.addEventListener("click", downloadNewPdf);
resetBtn.addEventListener("click", resetApp);

async function handleFiles(event) {
  const files = Array.from(event.target.files || []);
  if (files.length === 0) return;

  resetDataOnly();
  statusText.textContent = "PDF를 불러오는 중입니다...";

  for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
    const file = files[fileIndex];
    const buffer = await file.arrayBuffer();
    fileBuffers.push(buffer);

    const loadingTask = pdfjsLib.getDocument({ data: buffer.slice(0) });
    const pdf = await loadingTask.promise;

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 0.35 });

      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      await page.render({ canvasContext: context, viewport }).promise;

      const id = crypto.randomUUID();
      pageItems.push({
        id,
        fileIndex,
        pageIndex: pageNumber - 1,
        fileName: file.name,
        pageNumber
      });

      addPageCard(id, canvas, file.name, pageNumber);
    }
  }

  updateStatus();
}

function addPageCard(id, canvas, fileName, pageNumber) {
  const card = document.createElement("div");
  card.className = "page-card";
  card.dataset.id = id;

  const label = document.createElement("p");
  label.innerHTML = `<b>${escapeHtml(fileName)}</b><br>페이지 ${pageNumber}`;

  const deleteBtn = document.createElement("button");
  deleteBtn.className = "delete-btn";
  deleteBtn.textContent = "삭제";
  deleteBtn.addEventListener("click", () => {
    pageItems = pageItems.filter(item => item.id !== id);
    card.remove();
    updateStatus();
  });

  card.appendChild(canvas);
  card.appendChild(label);
  card.appendChild(deleteBtn);
  pageList.appendChild(card);
}

async function downloadNewPdf() {
  const orderedIds = Array.from(pageList.children).map(card => card.dataset.id);
  const orderedPages = orderedIds
    .map(id => pageItems.find(item => item.id === id))
    .filter(Boolean);

  if (orderedPages.length === 0) {
    alert("다운로드할 페이지가 없습니다.");
    return;
  }

  const outputPdf = await PDFLib.PDFDocument.create();
  const loadedDocs = [];

  for (const buffer of fileBuffers) {
    loadedDocs.push(await PDFLib.PDFDocument.load(buffer.slice(0)));
  }

  for (const item of orderedPages) {
    const [copiedPage] = await outputPdf.copyPages(loadedDocs[item.fileIndex], [item.pageIndex]);
    outputPdf.addPage(copiedPage);
  }

  const pdfBytes = await outputPdf.save();
  const blob = new Blob([pdfBytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "edited.pdf";
  a.click();

  URL.revokeObjectURL(url);
}

function updateStatus() {
  const count = pageList.children.length;
  statusText.textContent = count > 0
    ? `현재 ${count}개의 페이지가 있습니다. 드래그하여 순서를 바꿀 수 있습니다.`
    : "모든 페이지가 삭제되었습니다.";
  downloadBtn.disabled = count === 0;
}

function resetDataOnly() {
  pageItems = [];
  fileBuffers = [];
  pageList.innerHTML = "";
  downloadBtn.disabled = true;
}

function resetApp() {
  resetDataOnly();
  fileInput.value = "";
  statusText.textContent = "아직 업로드된 PDF가 없습니다.";
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
