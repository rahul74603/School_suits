const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  searchStudents: (q) => ipcRenderer.invoke("search-students", q),

  // ✅ Generic invoke
  invoke: (channel, data) => ipcRenderer.invoke(channel, data),

  // -----------------------------
  // ✅ OLD FUNCTIONS (Safe)
  // -----------------------------
  getStudents: (data) => ipcRenderer.invoke("get-students", data),
  createStudent: (data) => ipcRenderer.invoke("create-student", data),
  getStudentStatus: (data) => ipcRenderer.invoke("get-student-status", data),
  getNextReceiptNo: () => ipcRenderer.invoke("get-next-receipt-no"),
  createFeePayment: (data) => ipcRenderer.invoke("create-fee-payment", data),
  getFeePayments: (data) => ipcRenderer.invoke("get-fee-payments", data),

  // -----------------------------
  // ✅ NEW FUNCTIONS
  // -----------------------------
  getStudentByAdmNo: (admNo) =>
    ipcRenderer.invoke("get-student-by-admno", admNo),

  getStudentDocuments: (studentId) =>
    ipcRenderer.invoke("get-student-documents", studentId),

  uploadStudentDocument: (payload) =>
    ipcRenderer.invoke("upload-student-document", payload),

  // ✅ OPEN DOCUMENT
  openStudentDocument: (filePath) =>
    ipcRenderer.invoke("open-student-document", filePath),
});
