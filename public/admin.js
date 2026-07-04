/**
 * PrestaFlow - Administration Console Logic
 */

document.addEventListener('DOMContentLoaded', () => {
  // Config & State
  const { SUPABASE_URL, SUPABASE_ANON_KEY, STORAGE_BUCKET_NAME, ADMIN_PASSWORD } = window.PRESTAFLOW_CONFIG;
  let supabaseClient = null;
  let allPrestations = [];
  let filteredPrestations = [];

  // DOM Elements
  const prestationsList = document.getElementById('prestations-list');
  const searchBp = document.getElementById('search-bp');
  const filterStatus = document.getElementById('filter-status');
  const filterDate = document.getElementById('filter-date');
  const btnExportCsv = document.getElementById('btn-export-csv');
  
  // Lightbox
  const imageLightbox = document.getElementById('image-lightbox');
  const lightboxImg = document.getElementById('lightbox-img');
  const lightboxClose = document.getElementById('lightbox-close');

  // ==========================================
  // Authentication Lock
  // ==========================================

  function checkSession() {
    const sessionToken = localStorage.getItem('prestaflow_admin_session');
    if (sessionToken === ADMIN_PASSWORD) {
      initSupabase();
    } else {
      // Redirection vers le portail d'accueil sécurisé
      window.location.href = '/';
    }
  }

  // Call session check on load
  checkSession();

  // ==========================================
  // Supabase Initialization & Data Fetching
  // ==========================================

  function initSupabase() {
    if (supabaseClient) return; // already initialized
    
    try {
      supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      fetchData();
    } catch (error) {
      console.error('Erreur initialisation Supabase Client:', error);
      prestationsList.innerHTML = `
        <tr>
          <td colspan="6" class="empty-state">
            <i class="fa-solid fa-triangle-exclamation empty-icon danger-color"></i>
            <p>Erreur d'initialisation de la connexion Supabase. Vérifiez config.js.</p>
          </td>
        </tr>
      `;
    }
  }

  async function fetchData() {
    prestationsList.innerHTML = `
      <tr>
        <td colspan="6" class="empty-state">
          <div class="spinner" style="margin: 20px auto;"></div>
          Nettoyage et chargement des dossiers...
        </td>
      </tr>
    `;

    try {
      // Seuil de nettoyage de 6 heures
      const cutoffTime = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
      
      // 1. Récupérer les éléments obsolètes pour en extraire les chemins d'image
      const { data: oldItems, error: fetchOldError } = await supabaseClient
        .from('prestations')
        .select('photo_path')
        .lt('created_at', cutoffTime);
      
      if (!fetchOldError && oldItems && oldItems.length > 0) {
        const pathsToDelete = oldItems.map(item => item.photo_path);
        
        // Supprimer les fichiers correspondants dans le Storage
        const { error: storageDelError } = await supabaseClient.storage
          .from(STORAGE_BUCKET_NAME)
          .remove(pathsToDelete);
          
        if (storageDelError) {
          console.warn("Erreur suppression photos obsolètes:", storageDelError);
        }
        
        // Supprimer les entrées correspondantes dans la base
        const { error: dbDelError } = await supabaseClient
          .from('prestations')
          .delete()
          .lt('created_at', cutoffTime);
          
        if (dbDelError) {
          console.warn("Erreur suppression formulaires obsolètes:", dbDelError);
        }
      }

      // 2. Récupérer les prestations actives restantes (de moins de 6h)
      const { data, error } = await supabaseClient
        .from('prestations')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      allPrestations = data || [];
      applyFilters();

    } catch (error) {
      console.error('Erreur lors du traitement des données:', error);
      prestationsList.innerHTML = `
        <tr>
          <td colspan="6" class="empty-state">
            <i class="fa-solid fa-circle-xmark empty-icon danger-color"></i>
            <p>Erreur de traitement : ${error.message}</p>
          </td>
        </tr>
      `;
    }
  }

  // ==========================================
  // Rendering & Local Filtering
  // ==========================================

  function applyFilters() {
    const searchVal = searchBp.value.trim().toLowerCase();
    const statusVal = filterStatus.value;
    const dateVal = filterDate.value;

    filteredPrestations = allPrestations.filter(item => {
      // 1. Filter by BP search
      if (searchVal && !item.bp_number.toLowerCase().includes(searchVal)) {
        return false;
      }

      // 2. Filter by status
      if (statusVal) {
        const isFait = item.prestation_faite === 'oui';
        if (statusVal === 'faite' && !isFait) return false;
        if (statusVal === 'non_faite' && isFait) return false;
      }

      // 3. Filter by date
      if (dateVal) {
        const itemDate = new Date(item.created_at);
        const today = new Date();
        if (dateVal === 'today') {
          if (itemDate.toDateString() !== today.toDateString()) return false;
        } else if (dateVal === 'week') {
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(today.getDate() - 7);
          if (itemDate < sevenDaysAgo) return false;
        }
      }

      return true;
    });

    renderPrestations();
  }

  function renderPrestations() {
    if (filteredPrestations.length === 0) {
      prestationsList.innerHTML = `
        <tr>
          <td colspan="6" class="empty-state">
            <i class="fa-solid fa-folder-open empty-icon"></i>
            <p>Aucun dossier de prestation ne correspond aux critères.</p>
          </td>
        </tr>
      `;
      return;
    }

    prestationsList.innerHTML = '';
    
    filteredPrestations.forEach(item => {
      const tr = document.createElement('tr');
      
      // Date formatting
      const dateStr = new Date(item.created_at).toLocaleString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      // Photo URL retrieval from Supabase Storage
      const { data } = supabaseClient.storage.from(STORAGE_BUCKET_NAME).getPublicUrl(item.photo_path);
      const photoUrl = data.publicUrl;

      // Status Badge
      const isFait = item.prestation_faite === 'oui';
      const statusBadge = isFait 
        ? `<span class="badge badge-success"><i class="fa-solid fa-circle-check"></i> Validée</span>`
        : `<span class="badge badge-danger"><i class="fa-solid fa-circle-xmark"></i> Non faite</span>`;

      // Details summary formatting
      let detailsHtml = '-';
      if (!isFait) {
        if (item.raison === 'prestation_non_faite') {
          detailsHtml = `
            <strong>Prestation non faite</strong><br>
            À replanifier : ${item.replanifier === 'oui' ? 'Oui' : 'Non'}<br>
            ${item.replanifier === 'oui' ? `Date : ${formatSimpleDate(item.replanifier_date)}` : `Motif : ${item.motif_prestation_non_faite || '-'}`}
          `;
        } else if (item.raison === 'documents_manquants') {
          let docs = [];
          if (item.documents_manquants) {
            docs = Array.isArray(item.documents_manquants) ? item.documents_manquants : [item.documents_manquants];
          }
          const docsLabels = docs.map(d => {
            if (d === 'bon_prestation') return 'Bon prest.';
            if (d === 'bon_pesee') return 'Bon pesée';
            if (d === 'preuve_paiement') return 'Preuve paie.';
            return d;
          });
          detailsHtml = `
            <strong>Docs manquants</strong> : ${docsLabels.join(', ') || 'Aucun'}<br>
            Action : ${item.action_prevue === 'point_chauffeur' ? 'Point chauffeur' : 'Point REX'}
          `;
        } else if (item.raison === 'donnees_incompletes') {
          detailsHtml = `
            <strong>Données incomplètes</strong><br>
            Action : ${item.action_prevue === 'point_chauffeur' ? 'Point chauffeur' : 'Point REX'}
          `;
        }
      }

      tr.innerHTML = `
        <td>${dateStr}</td>
        <td><strong>${item.bp_number}</strong></td>
        <td>
          <img src="${photoUrl}" alt="Prestation" class="thumbnail-img" data-url="${photoUrl}">
        </td>
        <td>${statusBadge}</td>
        <td style="font-size: 0.8rem; line-height: 1.4;">${detailsHtml}</td>
        <td style="text-align: right;">
          <button type="button" class="action-btn download-zip-btn" data-id="${item.id}">
            Télécharger ZIP <i class="fa-solid fa-file-zipper"></i>
          </button>
        </td>
      `;

      prestationsList.appendChild(tr);
    });

    // Add Lightbox Event Listeners
    document.querySelectorAll('.thumbnail-img').forEach(img => {
      img.addEventListener('click', () => {
        const url = img.getAttribute('data-url');
        lightboxImg.src = url;
        imageLightbox.classList.remove('hidden');
      });
    });

    // Add ZIP Download Event Listeners
    document.querySelectorAll('.download-zip-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = parseInt(btn.getAttribute('data-id'));
        const prestation = allPrestations.find(item => item.id === id);
        if (prestation) {
          await downloadZip(prestation, btn);
        }
      });
    });
  }

  // Helper date formatter (YYYY-MM-DD to DD/MM/YYYY)
  function formatSimpleDate(dateString) {
    if (!dateString) return '-';
    const parts = dateString.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateString;
  }

  // Event Listeners for Filters
  searchBp.addEventListener('input', applyFilters);
  filterStatus.addEventListener('change', applyFilters);
  filterDate.addEventListener('change', applyFilters);

  // Close Lightbox
  lightboxClose.addEventListener('click', () => {
    imageLightbox.classList.add('hidden');
    lightboxImg.src = '';
  });
  
  imageLightbox.addEventListener('click', (e) => {
    if (e.target === imageLightbox) {
      imageLightbox.classList.add('hidden');
      lightboxImg.src = '';
    }
  });

  // ==========================================
  // ZIP Compilation (JSZip)
  // ==========================================

  async function downloadZip(prestation, buttonElement) {
    // Show loading state on button
    const originalHtml = buttonElement.innerHTML;
    buttonElement.disabled = true;
    buttonElement.innerHTML = `Patience... <i class="fa-solid fa-spinner fa-spin"></i>`;

    try {
      const sanitizedBp = prestation.bp_number.replace(/[^a-zA-Z0-9-_]/g, '');
      const folderName = `BP_${sanitizedBp}`;
      
      // Get photo URL
      const { data } = supabaseClient.storage.from(STORAGE_BUCKET_NAME).getPublicUrl(prestation.photo_path);
      const photoUrl = data.publicUrl;

      // 1. Fetch photo binary blob
      const photoResponse = await fetch(photoUrl);
      if (!photoResponse.ok) throw new Error("Impossible de charger la photo depuis Supabase Storage.");
      const photoBlob = await photoResponse.blob();

      // 2. Prepare JSON data
      const jsonContent = {
        bpNumber: prestation.bp_number,
        prestationFaite: prestation.prestation_faite,
        raison: prestation.raison,
        replanifier: prestation.replanifier,
        replanifierDate: prestation.replanifier_date,
        motifPrestationNonFaite: prestation.motif_prestation_non_faite,
        documentsManquants: prestation.documents_manquants,
        actionPrevue: prestation.action_prevue,
        photoName: `photo.jpg`,
        timestamp: prestation.created_at
      };

      // 3. Prepare recap report text file
      const recapContent = generateRecapTextContent(jsonContent, folderName);

      // 4. Compile ZIP
      const zip = new JSZip();
      zip.file('photo.jpg', photoBlob);
      zip.file('donnees.json', JSON.stringify(jsonContent, null, 2));
      zip.file('recapitulatif.txt', recapContent);

      // 5. Trigger download on browser
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      saveAs(zipBlob, `${folderName}.zip`);

    } catch (error) {
      console.error("Erreur lors de la compilation du ZIP:", error);
      alert("Une erreur est survenue lors de la création du fichier ZIP : " + error.message);
    } finally {
      // Restore button
      buttonElement.disabled = false;
      buttonElement.innerHTML = originalHtml;
    }
  }

  // Generates human-readable recap text file (mirroring server logic client-side)
  function generateRecapTextContent(data, folderName) {
    const dateStr = new Date(data.timestamp).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' });
    let content = `==================================================
FICHE DE PRESTATION : ${folderName}
Date d'enregistrement : ${dateStr}
==================================================

`;
    
    if (data.prestationFaite === 'oui') {
      content += `STATUT : Prestation Validée (Fait)\n`;
    } else {
      content += `STATUT : Prestation non validée (Non faite)\n`;
      content += `--------------------------------------------------\n`;
      content += `Raison : `;
      
      if (data.raison === 'prestation_non_faite') {
        content += `Prestation non faite\n`;
        content += `À replanifier ? : ${data.replanifier === 'oui' ? 'Oui' : 'Non'}\n`;
        if (data.replanifier === 'oui') {
          content += `Date de replanification : ${formatSimpleDate(data.replanifierDate)}\n`;
        } else {
          content += `Motif : ${data.motifPrestationNonFaite || 'Non spécifié'}\n`;
        }
      } else if (data.raison === 'documents_manquants') {
        content += `Documents manquants\n`;
        let docsList = [];
        if (data.documentsManquants) {
          docsList = Array.isArray(data.documentsManquants) 
            ? data.documentsManquants 
            : [data.documentsManquants];
        }
        content += `Documents manquants identifiés :\n`;
        docsList.forEach(doc => {
          let label = doc;
          if (doc === 'bon_prestation') label = 'Bon de prestation';
          if (doc === 'bon_pesee') label = 'Bon de pesée';
          if (doc === 'preuve_paiement') label = 'Preuve de paiement si comptant';
          content += `  - ${label}\n`;
        });
        
        const actionLabel = data.actionPrevue === 'point_chauffeur' 
          ? 'Point avec chauffeur' 
          : (data.actionPrevue === 'point_rex' ? 'Point avec REX' : 'Non spécifié');
        content += `Action prévue : ${actionLabel}\n`;
      } else if (data.raison === 'donnees_incompletes') {
        content += `Données incomplètes\n`;
        const actionLabel = data.actionPrevue === 'point_chauffeur' 
          ? 'Point avec chauffeur' 
          : (data.actionPrevue === 'point_rex' ? 'Point avec REX' : 'Non spécifié');
        content += `Action prévue : ${actionLabel}\n`;
      }
    }
    
    content += `\nFichiers associés :\n`;
    content += `- Photo des documents : photo.jpg\n`;
    content += `==================================================\n`;
    return content;
  }

  // ==========================================
  // CSV Export
  // ==========================================

  btnExportCsv.addEventListener('click', () => {
    if (filteredPrestations.length === 0) {
      alert("Aucune donnée à exporter.");
      return;
    }

    let csvContent = "\uFEFF"; // BOM for Excel UTF-8 support
    // Headers
    csvContent += "Date d'enregistrement;Numero BP;Fait ?;Raison;Replanifier;Date Replanification;Motif;Documents Manquants;Action Prevue\n";

    filteredPrestations.forEach(item => {
      const dateStr = new Date(item.created_at).toLocaleString('fr-FR');
      const bp = item.bp_number;
      const fait = item.prestation_faite;
      const raison = item.raison || "";
      const replan = item.replanifier || "";
      const dateRep = item.replanifier_date || "";
      const motif = (item.motif_prestation_non_faite || "").replace(/;/g, ",").replace(/\n/g, " ");
      
      let docs = [];
      if (item.documents_manquants) {
        docs = Array.isArray(item.documents_manquants) ? item.documents_manquants : [item.documents_manquants];
      }
      const docsStr = docs.join(" | ");
      
      const action = item.action_prevue || "";

      csvContent += `"${dateStr}";"${bp}";"${fait}";"${raison}";"${replan}";"${dateRep}";"${motif}";"${docsStr}";"${action}"\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, `prestations_export_${Date.now()}.csv`);
  });
});
