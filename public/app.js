/**
 * PrestaFlow - Frontend application logic
 */
// Register Service Worker for PWA compliance
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js')
    .then(() => console.log('Service Worker de PrestaFlow enregistré avec succès.'))
    .catch(err => console.error('Échec d\'enregistrement du Service Worker:', err));
}

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const form = document.getElementById('prestation-form');
  const bpInput = document.getElementById('bpNumber');
  const fileInput = document.getElementById('photo');
  const uploadZone = document.getElementById('upload-zone');
  const uploadPreviewContainer = document.getElementById('upload-preview-container');
  const previewImg = document.getElementById('preview-img');
  const btnRemovePhoto = document.getElementById('btn-remove-photo');
  
  // Navigation
  const formSteps = document.querySelectorAll('.form-step');
  const stepNodes = document.querySelectorAll('.step-node');
  const stepLines = document.querySelectorAll('.step-line');
  const nextButtons = document.querySelectorAll('.btn-next');
  const prevButtons = document.querySelectorAll('.btn-prev');
  
  // Conditional UI blocks
  const step3Desc = document.getElementById('step-3-desc');
  const sectionPrestationFaite = document.getElementById('section-prestation-faite');
  const sectionPrestationNonFaite = document.getElementById('section-prestation-non-faite');
  
  const selectRaison = document.getElementById('raison');
  const subPrestationNonFaite = document.getElementById('sub-prestation-non-faite');
  const subDocumentsManquants = document.getElementById('sub-documents-manquants');
  const subDonneesIncompletes = document.getElementById('sub-donnees-incompletes');
  
  const replanifierRadios = document.getElementsByName('replanifier');
  const inputReplanifierDate = document.getElementById('input-replanifier-date');
  const inputMotif = document.getElementById('input-motif');
  const replanifierDateInput = document.getElementById('replanifierDate');
  const motifInput = document.getElementById('motifPrestationNonFaite');

  // Overlay Screens
  const statusOverlay = document.getElementById('status-overlay');
  const statusLoading = document.getElementById('status-loading');
  const statusSuccess = document.getElementById('status-success');
  const statusError = document.getElementById('status-error');
  const successFolderName = document.getElementById('success-folder-name');
  const successStoragePath = document.getElementById('success-storage-path');
  const errorServerMsg = document.getElementById('error-server-msg');
  const btnReset = document.getElementById('btn-reset');
  const btnRetryClose = document.getElementById('btn-retry-close');

  let currentStep = 1;
  let selectedFile = null;

  // Set minimum date for rescheduling to today
  const today = new Date().toISOString().split('T')[0];
  replanifierDateInput.min = today;

  // ==========================================
  // File Upload & Drag 'n' Drop Handling
  // ==========================================

  // Click on upload zone triggers file explorer
  uploadZone.addEventListener('click', (e) => {
    // Prevent triggering twice if they click the file input directly
    if (e.target !== fileInput && !btnRemovePhoto.contains(e.target) && !previewImg.contains(e.target)) {
      fileInput.click();
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleFileSelected(e.target.files[0]);
    }
  });

  // Drag events
  ['dragenter', 'dragover'].forEach(eventName => {
    uploadZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      uploadZone.classList.add('drag-over');
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    uploadZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      uploadZone.classList.remove('drag-over');
    }, false);
  });

  uploadZone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files.length > 0) {
      fileInput.files = files; // Sync back to input
      handleFileSelected(files[0]);
    }
  });

  function handleFileSelected(file) {
    if (!file.type.startsWith('image/')) {
      alert('Veuillez sélectionner un fichier image valide.');
      return;
    }
    
    selectedFile = file;
    
    // Read and display image preview
    const reader = new FileReader();
    reader.onload = (e) => {
      previewImg.src = e.target.result;
      document.querySelector('.upload-placeholder').classList.add('hidden');
      uploadPreviewContainer.classList.remove('hidden');
      
      // Clear error message if photo was missing
      clearError('photo');
    };
    reader.readAsDataURL(file);
  }

  btnRemovePhoto.addEventListener('click', (e) => {
    e.stopPropagation();
    resetUploadZone();
  });

  function resetUploadZone() {
    selectedFile = null;
    fileInput.value = '';
    previewImg.src = '';
    uploadPreviewContainer.classList.add('hidden');
    document.querySelector('.upload-placeholder').classList.remove('hidden');
  }

  // ==========================================
  // Form Navigation & Conditional Logic
  // ==========================================

  // Step routing logic
  nextButtons.forEach(button => {
    button.addEventListener('click', () => {
      const nextStep = parseInt(button.getAttribute('data-next'));
      if (validateStep(currentStep)) {
        goToStep(nextStep);
      }
    });
  });

  prevButtons.forEach(button => {
    button.addEventListener('click', () => {
      const prevStep = parseInt(button.getAttribute('data-prev'));
      goToStep(prevStep);
    });
  });

  // Directly clicking completed steps in indicator
  stepNodes.forEach(node => {
    node.addEventListener('click', () => {
      const stepTarget = parseInt(node.getAttribute('data-step'));
      if (stepTarget < currentStep) {
        goToStep(stepTarget);
      } else if (stepTarget > currentStep) {
        // Can only jump forward if all intermediate steps validate
        let valid = true;
        for (let i = currentStep; i < stepTarget; i++) {
          if (!validateStep(i)) {
            valid = false;
            break;
          }
        }
        if (valid) goToStep(stepTarget);
      }
    });
  });

  function goToStep(stepNum) {
    // Hide all steps
    formSteps.forEach(step => step.classList.remove('active'));
    
    // Show target step
    document.getElementById(`step-${stepNum}`).classList.add('active');
    
    currentStep = stepNum;
    updateStepIndicator();
    
    // If arriving at step 3, setup the specific conditional layout
    if (stepNum === 3) {
      setupStep3Layout();
    }
  }

  function updateStepIndicator() {
    stepNodes.forEach((node, idx) => {
      const stepIndex = idx + 1;
      node.classList.remove('active', 'completed');
      
      if (stepIndex === currentStep) {
        node.classList.add('active');
      } else if (stepIndex < currentStep) {
        node.classList.add('completed');
      }
    });

    stepLines.forEach((line, idx) => {
      const lineIndex = idx + 1;
      line.classList.remove('active');
      if (lineIndex < currentStep) {
        line.classList.add('active');
      }
    });
  }

  // Logic: Prestation Faite radio selections
  document.getElementsByName('prestationFaite').forEach(radio => {
    radio.addEventListener('change', () => {
      clearError('prestationFaite');
    });
  });

  // Setup Step 3 Layout based on Step 2 answers
  function setupStep3Layout() {
    const isFaite = document.querySelector('input[name="prestationFaite"]:checked').value === 'oui';
    
    if (isFaite) {
      step3Desc.textContent = "Récapitulatif de la prestation validée.";
      sectionPrestationFaite.classList.remove('hidden');
      sectionPrestationNonFaite.classList.add('hidden');
    } else {
      step3Desc.textContent = "Veuillez renseigner les raisons du blocage ou de l'anomalie.";
      sectionPrestationFaite.classList.add('hidden');
      sectionPrestationNonFaite.classList.remove('hidden');
      
      // Trigger select handler to show current sub-section
      handleRaisonChange();
    }
  }

  // Logic: Why is the prestation not done (select dropdown)
  selectRaison.addEventListener('change', () => {
    clearError('raison');
    handleRaisonChange();
  });

  function handleRaisonChange() {
    const reasonValue = selectRaison.value;
    
    // Hide all sub sections first
    subPrestationNonFaite.classList.add('hidden');
    subDocumentsManquants.classList.add('hidden');
    subDonneesIncompletes.classList.add('hidden');
    
    // Show the active sub section
    if (reasonValue === 'prestation_non_faite') {
      subPrestationNonFaite.classList.remove('hidden');
      handleReplanifierChange();
    } else if (reasonValue === 'documents_manquants') {
      subDocumentsManquants.classList.remove('hidden');
    } else if (reasonValue === 'donnees_incompletes') {
      subDonneesIncompletes.classList.remove('hidden');
    }
  }

  // Logic: Replanifier Radio handling
  replanifierRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      clearError('replanifier');
      handleReplanifierChange();
    });
  });

  function handleReplanifierChange() {
    const checkedRadio = document.querySelector('input[name="replanifier"]:checked');
    if (!checkedRadio) {
      inputReplanifierDate.classList.add('hidden');
      inputMotif.classList.add('hidden');
      return;
    }
    
    const value = checkedRadio.value;
    if (value === 'oui') {
      inputReplanifierDate.classList.remove('hidden');
      inputMotif.classList.add('hidden');
    } else {
      inputReplanifierDate.classList.add('hidden');
      inputMotif.classList.remove('hidden');
    }
  }

  // Clear sub errors when inputs get input
  replanifierDateInput.addEventListener('change', () => clearError('replanifierDate'));
  motifInput.addEventListener('input', () => clearError('motifPrestationNonFaite'));
  
  document.getElementsByName('actionPrevue').forEach(radio => {
    radio.addEventListener('change', () => clearError('actionPrevue'));
  });
  
  document.getElementsByName('actionPrevueDI').forEach(radio => {
    radio.addEventListener('change', () => clearError('actionPrevueDI'));
  });

  // Watch checkboxes for documents manquants to clear error
  document.getElementsByName('documentsManquants').forEach(checkbox => {
    checkbox.addEventListener('change', () => {
      const checked = document.querySelectorAll('input[name="documentsManquants"]:checked');
      if (checked.length > 0) {
        clearError('documentsManquants');
      }
    });
  });

  // ==========================================
  // Validation Logic
  // ==========================================

  function showError(fieldId, msg) {
    const group = document.getElementById(`error-${fieldId}`).parentElement;
    group.classList.add('has-error');
    const errMsg = document.getElementById(`error-${fieldId}`);
    if (msg) errMsg.textContent = msg;
    errMsg.style.display = 'block';
  }

  // Clear errors helper
  function clearError(fieldId) {
    const errMsg = document.getElementById(`error-${fieldId}`);
    if (errMsg) {
      errMsg.parentElement.classList.remove('has-error');
      errMsg.style.display = 'none';
    }
  }

  function validateStep(stepNum) {
    let isValid = true;
    
    if (stepNum === 1) {
      // Validate BP number
      if (bpInput.value.trim() === '') {
        showError('bpNumber');
        isValid = false;
      } else {
        clearError('bpNumber');
      }
      
      // Validate Photo
      if (!selectedFile) {
        showError('photo');
        isValid = false;
      } else {
        clearError('photo');
      }
    } 
    else if (stepNum === 2) {
      const checkedPrestation = document.querySelector('input[name="prestationFaite"]:checked');
      if (!checkedPrestation) {
        showError('prestationFaite');
        isValid = false;
      } else {
        clearError('prestationFaite');
      }
    }
    
    return isValid;
  }

  function validateStep3() {
    let isValid = true;
    const isFaite = document.querySelector('input[name="prestationFaite"]:checked').value === 'oui';
    
    if (isFaite) {
      return true; // No extra fields to validate if Prestation is Done
    }
    
    // Validate Raison select dropdown
    const reasonValue = selectRaison.value;
    if (!reasonValue) {
      showError('raison');
      isValid = false;
    } else {
      clearError('raison');
    }
    
    if (reasonValue === 'prestation_non_faite') {
      const replanifierChecked = document.querySelector('input[name="replanifier"]:checked');
      if (!replanifierChecked) {
        showError('replanifier');
        isValid = false;
      } else {
        clearError('replanifier');
        
        const repVal = replanifierChecked.value;
        if (repVal === 'oui') {
          if (!replanifierDateInput.value) {
            showError('replanifierDate');
            isValid = false;
          } else {
            clearError('replanifierDate');
          }
        } else {
          if (motifInput.value.trim() === '') {
            showError('motifPrestationNonFaite');
            isValid = false;
          } else {
            clearError('motifPrestationNonFaite');
          }
        }
      }
    } 
    else if (reasonValue === 'documents_manquants') {
      // Checkboxes: at least one
      const checkedDocs = document.querySelectorAll('input[name="documentsManquants"]:checked');
      if (checkedDocs.length === 0) {
        showError('documentsManquants');
        isValid = false;
      } else {
        clearError('documentsManquants');
      }
      
      // Radio action prevue
      const actionChecked = document.querySelector('input[name="actionPrevue"]:checked');
      if (!actionChecked) {
        showError('actionPrevue');
        isValid = false;
      } else {
        clearError('actionPrevue');
      }
    } 
    else if (reasonValue === 'donnees_incompletes') {
      // Radio action prevue DI
      const actionCheckedDI = document.querySelector('input[name="actionPrevueDI"]:checked');
      if (!actionCheckedDI) {
        showError('actionPrevueDI');
        isValid = false;
      } else {
        clearError('actionPrevueDI');
      }
    }
    
    return isValid;
  }

  // ==========================================
  // Form Submission
  // ==========================================

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    
    if (!validateStep(1) || !validateStep(2) || !validateStep3()) {
      return;
    }
    
    // Open Status Overlay & Show loading screen
    statusOverlay.classList.remove('hidden');
    statusLoading.classList.remove('hidden');
    statusSuccess.classList.add('hidden');
    statusError.classList.add('hidden');
    
    const formData = new FormData();
    formData.append('bpNumber', bpInput.value.trim());
    formData.append('photo', selectedFile);
    
    const prestFaite = document.querySelector('input[name="prestationFaite"]:checked').value;
    formData.append('prestationFaite', prestFaite);
    
    if (prestFaite === 'non') {
      const reason = selectRaison.value;
      formData.append('raison', reason);
      
      if (reason === 'prestation_non_faite') {
        const replanifier = document.querySelector('input[name="replanifier"]:checked').value;
        formData.append('replanifier', replanifier);
        
        if (replanifier === 'oui') {
          formData.append('replanifierDate', replanifierDateInput.value);
        } else {
          formData.append('motifPrestationNonFaite', motifInput.value.trim());
        }
      } 
      else if (reason === 'documents_manquants') {
        const checkedDocs = Array.from(document.querySelectorAll('input[name="documentsManquants"]:checked')).map(cb => cb.value);
        formData.append('documentsManquants', JSON.stringify(checkedDocs));
        formData.append('actionPrevue', document.querySelector('input[name="actionPrevue"]:checked').value);
      } 
      else if (reason === 'donnees_incompletes') {
        formData.append('actionPrevue', document.querySelector('input[name="actionPrevueDI"]:checked').value);
      }
    }

    // Submit data to Express API
    fetch('/api/prestation', {
      method: 'POST',
      body: formData
    })
    .then(response => {
      if (!response.ok) {
        return response.json().then(errData => {
          throw new Error(errData.error || 'Erreur serveur.');
        });
      }
      return response.json();
    })
    .then(data => {
      if (data.success) {
        // Show Success screen
        statusLoading.classList.add('hidden');
        statusSuccess.classList.remove('hidden');
        successFolderName.textContent = data.folderName;
        successStoragePath.textContent = data.storagePath;
      } else {
        throw new Error(data.error || 'Erreur inconnue.');
      }
    })
    .catch(error => {
      console.error('Erreur soumission:', error);
      statusLoading.classList.add('hidden');
      statusError.classList.remove('hidden');
      errorServerMsg.textContent = error.message || 'Impossible de créer le dossier sur le serveur. Veuillez réessayer.';
    });
  });

  // Reset form after success to enter another prestation
  btnReset.addEventListener('click', () => {
    // Reset fields
    form.reset();
    resetUploadZone();
    
    // Hide overlay
    statusOverlay.classList.add('hidden');
    
    // Back to step 1
    goToStep(1);
  });

  // Retry or Close error screen
  btnRetryClose.addEventListener('click', () => {
    statusOverlay.classList.add('hidden');
  });
});
