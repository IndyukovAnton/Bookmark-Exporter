document.addEventListener('DOMContentLoaded', () => {
  const controller = window.BookmarkExporterPopupController.createPopupController();

  controller.init().catch((error) => {
    console.error('Popup initialization failed:', error);
  });
});
