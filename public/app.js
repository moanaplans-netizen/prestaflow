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
  // Gateway Authentication Logic
  const gatewayOverlay = document.getElementById('gateway-overlay');
  const gatewayForm = document.getElementById('gateway-form');
  const gatewayPass = document.getElementById('gateway-pass');
  const gatewayError = document.getElementById('gateway-error');
  const mainApp = document.getElementById('main-app');

  const { AGENT_PASSWORD, ADMIN_PASSWORD } = window.PRESTAFLOW_CONFIG;

  function checkGatewaySession() {
    const session = sessionStorage.getItem('prestaflow_agent_session');
    if (session === AGENT_PASSWORD) {
      gatewayOverlay.style.display = 'none';
      mainApp.style.display = 'block';
    } else if (session === ADMIN_PASSWORD) {
      window.location.href = '/admin';
    } else {
      gatewayOverlay.style.display = 'flex';
      mainApp.style.display = 'none';
    }
  }

  gatewayForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const pass = gatewayPass.value;
    if (pass === AGENT_PASSWORD) {
      sessionStorage.setItem('prestaflow_agent_session', pass);
      gatewayOverlay.style.display = 'none';
      mainApp.style.display = 'block';
      gatewayError.style.display = 'none';
    } else if (pass === ADMIN_PASSWORD) {
      localStorage.setItem('prestaflow_admin_session', pass);
      window.location.href = '/admin';
    } else {
      gatewayError.style.display = 'block';
      gatewayPass.value = '';
    }
  });

  checkGatewaySession();

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

  // Supplier Tracking DOM Elements
  const btnAddSupplier = document.getElementById('btn-add-supplier');
  const suppliersContainer = document.getElementById('suppliers-list-container');

  let currentStep = 1;
  let selectedFile = null;
  let supplierIndex = 0;

  function createSupplierCardHTML(index) {
    return `
      <div class="supplier-card" id="supplier-card-${index}">
        <div class="supplier-card-header">
          <h3>Suivi Fournisseur #${index + 1}</h3>
          <button type="button" class="btn-remove-supplier" data-index="${index}">&times;</button>
        </div>
        <div class="supplier-card-body">
          <div class="input-group">
            <label>Fournisseur</label>
            <div class="input-wrapper">
              <i class="fa-solid fa-industry input-icon"></i>
              <select class="supplier-select" required>
                <option value="">-- Choisir un fournisseur --</option>
                <option value="CET HITIAA">CET HITIAA</option>
                <option value="CET PAIHORO">CET PAIHORO</option>
                <option value="TAHITI AGREGATS">TAHITI AGREGATS</option>
                <option value="TNL DV">TNL DV</option>
                <option value="TNL DS">TNL DS</option>
                <option value="ENVIROPOL">ENVIROPOL</option>
                <option value="FACE">FACE</option>
                <option value="CRT">CRT</option>
                <option value="TANKS HU TSP">TANKS HU TSP</option>
              </select>
            </div>
            <div class="error-message error-supplier-select" style="display: none; margin-top: 5px;">Veuillez choisir un fournisseur.</div>
          </div>
          
          <div class="input-grid-2">
            <div class="input-group">
              <label>N° de Bon de Pesée</label>
              <div class="input-wrapper">
                <i class="fa-solid fa-hashtag input-icon"></i>
                <input type="text" class="supplier-bon-pesee" placeholder="Ex: BP-1234">
              </div>
            </div>
            <div class="input-group">
              <label>Nom du client</label>
              <div class="input-wrapper">
                <i class="fa-solid fa-user input-icon"></i>
                <input type="text" class="supplier-nom-client" placeholder="Ex: Air Tahiti">
              </div>
            </div>
          </div>
          
          <div class="input-grid-2">
            <div class="input-group">
              <label>Nom du chauffeur</label>
              <div class="input-wrapper">
                <i class="fa-solid fa-id-card input-icon"></i>
                <input type="text" class="supplier-nom-chauffeur" placeholder="Ex: Teva">
              </div>
            </div>
            <div class="input-group">
              <label>Mesure (pesée ou volume)</label>
              <div class="input-wrapper">
                <i class="fa-solid fa-scale-balanced input-icon"></i>
                <input type="text" class="supplier-mesure" placeholder="Ex: 12.4 t ou 5 m³">
              </div>
            </div>
          </div>
          
          <div class="input-group">
            <label>Type de déchet</label>
            <div class="input-wrapper">
              <i class="fa-solid fa-trash-can input-icon"></i>
              <input type="text" class="supplier-type-dechet" placeholder="Ex: DIB, Gravats, Huiles...">
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function renameSupplierHeaders() {
    const cards = suppliersContainer.querySelectorAll('.supplier-card');
    cards.forEach((card, idx) => {
      card.querySelector('h3').textContent = `Suivi Fournisseur #${idx + 1}`;
    });
  }

  btnAddSupplier.addEventListener('click', () => {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = createSupplierCardHTML(supplierIndex);
    const cardNode = tempDiv.firstElementChild;
    suppliersContainer.appendChild(cardNode);
    
    // Add remove listener
    cardNode.querySelector('.btn-remove-supplier').addEventListener('click', () => {
      cardNode.remove();
      renameSupplierHeaders();
    });

    // Clear error style on select change
    cardNode.querySelector('.supplier-select').addEventListener('change', (e) => {
      if (e.target.value !== '') {
        cardNode.querySelector('.error-supplier-select').style.display = 'none';
        e.target.parentElement.parentElement.classList.remove('has-error');
      }
    });
    
    supplierIndex++;
  });

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
      let valid = false;
      if (currentStep === 1 || currentStep === 2) {
        valid = validateStep(currentStep);
      } else if (currentStep === 3) {
        valid = validateStep3();
      } else {
        valid = true;
      }
      if (valid) {
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
          let stepValid = false;
          if (i === 1 || i === 2) {
            stepValid = validateStep(i);
          } else if (i === 3) {
            stepValid = validateStep3();
          } else if (i === 4) {
            stepValid = validateStep4();
          } else {
            stepValid = true;
          }
          if (!stepValid) {
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

  function validateStep4() {
    let isValid = true;
    const cards = suppliersContainer.querySelectorAll('.supplier-card');
    cards.forEach(card => {
      const select = card.querySelector('.supplier-select');
      const err = card.querySelector('.error-supplier-select');
      if (select.value === '') {
        err.style.display = 'block';
        select.parentElement.parentElement.classList.add('has-error');
        isValid = false;
      } else {
        err.style.display = 'none';
        select.parentElement.parentElement.classList.remove('has-error');
      }
    });
    return isValid;
  }

  // ==========================================
  // Form Submission (Supabase)
  // ==========================================

  // Initialize Supabase Client
  const { SUPABASE_URL, SUPABASE_ANON_KEY, STORAGE_BUCKET_NAME } = window.PRESTAFLOW_CONFIG;
  const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!validateStep(1) || !validateStep(2) || !validateStep3() || !validateStep4()) {
      return;
    }
    
    // Open Status Overlay & Show loading screen
    statusOverlay.classList.remove('hidden');
    statusLoading.classList.remove('hidden');
    statusSuccess.classList.add('hidden');
    statusError.classList.add('hidden');
    
    try {
      const bpVal = bpInput.value.trim();
      const sanitizedBp = bpVal.replace(/[^a-zA-Z0-9-_]/g, '');
      const ext = selectedFile.name.split('.').pop() || 'jpg';
      const photoPath = `${sanitizedBp}_${Date.now()}.${ext}`;

      // 1. Upload photo to Supabase Storage Bucket
      const { data: uploadData, error: uploadError } = await supabaseClient.storage
        .from(STORAGE_BUCKET_NAME)
        .upload(photoPath, selectedFile, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        throw new Error("Échec du téléversement de la photo: " + uploadError.message);
      }

      // 2. Prepare database fields
      const prestFaite = document.querySelector('input[name="prestationFaite"]:checked').value;
      
      let raison = null;
      let replanifier = null;
      let replanifierDate = null;
      let motifPrestationNonFaite = null;
      let documentsManquants = null;
      let actionPrevue = null;

      if (prestFaite === 'non') {
        raison = selectRaison.value;
        if (raison === 'prestation_non_faite') {
          replanifier = document.querySelector('input[name="replanifier"]:checked').value;
          if (replanifier === 'oui') {
            replanifierDate = replanifierDateInput.value;
          } else {
            motifPrestationNonFaite = motifInput.value.trim();
          }
        } else if (raison === 'documents_manquants') {
          documentsManquants = Array.from(document.querySelectorAll('input[name="documentsManquants"]:checked')).map(cb => cb.value);
          actionPrevue = document.querySelector('input[name="actionPrevue"]:checked').value;
        } else if (raison === 'donnees_incompletes') {
          actionPrevue = document.querySelector('input[name="actionPrevueDI"]:checked').value;
        }
      }

      // Collect supplier tracking data
      const suiviFournisseurs = [];
      const cards = suppliersContainer.querySelectorAll('.supplier-card');
      cards.forEach(card => {
        suiviFournisseurs.push({
          fournisseur: card.querySelector('.supplier-select').value,
          bon_pesee: card.querySelector('.supplier-bon-pesee').value.trim() || null,
          nom_client: card.querySelector('.supplier-nom-client').value.trim() || null,
          nom_chauffeur: card.querySelector('.supplier-nom-chauffeur').value.trim() || null,
          mesure: card.querySelector('.supplier-mesure').value.trim() || null,
          type_dechet: card.querySelector('.supplier-type-dechet').value.trim() || null
        });
      });

      // 3. Insert record into prestations table
      const { data: insertData, error: insertError } = await supabaseClient
        .from('prestations')
        .insert([
          {
            bp_number: bpVal,
            prestation_faite: prestFaite,
            raison: raison,
            replanifier: replanifier,
            replanifier_date: replanifierDate || null,
            motif_prestation_non_faite: motifPrestationNonFaite || null,
            documents_manquants: documentsManquants,
            action_prevue: actionPrevue,
            photo_path: photoPath,
            suivi_fournisseurs: suiviFournisseurs.length > 0 ? suiviFournisseurs : null
          }
        ]);

      if (insertError) {
        throw new Error("Échec d'enregistrement en base de données: " + insertError.message);
      }

      // Show Success screen
      statusLoading.classList.add('hidden');
      statusSuccess.classList.remove('hidden');
      successFolderName.textContent = `BP_${sanitizedBp}`;
      successStoragePath.textContent = 'Stockage Cloud Supabase';

    } catch (error) {
      console.error('Erreur soumission Supabase:', error);
      statusLoading.classList.add('hidden');
      statusError.classList.remove('hidden');
      errorServerMsg.textContent = error.message || 'Une erreur est survenue lors de l\'enregistrement.';
    }
  });

  // Reset form after success to enter another prestation
  btnReset.addEventListener('click', () => {
    // Reset fields
    form.reset();
    resetUploadZone();
    
    // Clear dynamic supplier cards
    suppliersContainer.innerHTML = '';
    supplierIndex = 0;
    
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
