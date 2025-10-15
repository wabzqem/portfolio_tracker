// Welcome screen file handling
document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('dropZone');
    const browseButton = document.getElementById('browseButton');
    const fileInput = document.getElementById('fileInput');
    const loading = document.getElementById('loading');
    const errorMessage = document.getElementById('errorMessage');

    // File drop handling
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            const file = files[0];
            handleFile({ path: file.path, name: file.name });
        }
    });

    // Browse button handling
    browseButton.addEventListener('click', async () => {
        try {
            const filePath = await window.electronAPI.openFileDialog();
            if (filePath) {
                handleFile({ path: filePath, name: filePath.split(/[/\\]/).pop() });
            }
        } catch (error) {
            console.error('Error opening file dialog:', error);
            showError('Failed to open file dialog.');
        }
    });

    // Handle file selection
    async function handleFile(file) {
        // Validate file type
        if (!file.name.toLowerCase().endsWith('.csv')) {
            showError('Please select a CSV file.');
            return;
        }

        // Show loading state
        showLoading();
        hideError();

        try {
            // Load the CSV file
            const success = await window.electronAPI.loadTradesFile(file.path);
            
            if (success) {
                // The main process will automatically redirect to index.html
                console.log('File loaded successfully');
            } else {
                showError('Failed to load the CSV file. Please check the file format and ensure it contains valid trading data.');
            }
        } catch (error) {
            console.error('Error loading file:', error);
            showError(`Error loading file: ${error.message}`);
        } finally {
            hideLoading();
        }
    }

    function showLoading() {
        loading.style.display = 'block';
        dropZone.style.display = 'none';
    }

    function hideLoading() {
        loading.style.display = 'none';
        dropZone.style.display = 'block';
    }

    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
    }

    function hideError() {
        errorMessage.style.display = 'none';
    }
});