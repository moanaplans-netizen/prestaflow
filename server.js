const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const { google } = require('googleapis');
const { Readable } = require('stream');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const STORAGE_PATH = path.resolve(process.env.STORAGE_PATH || './storage');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Configure Multer to keep files in memory
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Initialize Google Drive API connection if credentials are provided
let drive = null;
const credentialsEnv = process.env.GOOGLE_CREDENTIALS;
const parentFolderId = process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID;

if (credentialsEnv && parentFolderId) {
  try {
    let credentials = {};
    if (credentialsEnv.trim().startsWith('{')) {
      credentials = JSON.parse(credentialsEnv);
    } else {
      // Decode base64 in case the key was set as base64 to avoid multiline environment variable issues
      const decoded = Buffer.from(credentialsEnv, 'base64').toString('utf-8');
      credentials = JSON.parse(decoded);
    }

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/drive']
    });
    drive = google.drive({ version: 'v3', auth });
    console.log(' Connexion API Google Drive configurée avec succès.');
  } catch (error) {
    console.error('❌ Erreur lors de la configuration de l\'API Google Drive:', error.message);
  }
} else {
  console.log('ℹ️ Mode Local actif (les variables Google Drive ne sont pas toutes configurées).');
  // Ensure local storage directory exists
  if (!fs.existsSync(STORAGE_PATH)) {
    fs.mkdirSync(STORAGE_PATH, { recursive: true });
  }
}

/**
 * Returns a unique folder name on Google Drive (appends suffix if folder name exists).
 */
async function getUniqueDriveFolderName(driveInstance, parentId, bpNumber) {
  const sanitizedBp = bpNumber.replace(/[^a-zA-Z0-9-_]/g, '');
  let folderName = `BP_${sanitizedBp}`;
  
  let counter = 1;
  let isUnique = false;
  
  while (!isUnique) {
    const query = `name = '${folderName}' and '${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
    const res = await driveInstance.files.list({
      q: query,
      fields: 'files(id)'
    });
    if (res.data.files.length === 0) {
      isUnique = true;
    } else {
      folderName = `BP_${sanitizedBp}_${counter}`;
      counter++;
    }
  }
  return folderName;
}

/**
 * Creates a folder inside the parent folder in Google Drive and returns its ID.
 */
async function createDriveFolder(driveInstance, parentId, folderName) {
  const folderMetadata = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder',
    parents: [parentId]
  };

  const response = await driveInstance.files.create({
    resource: folderMetadata,
    fields: 'id'
  });
  return response.data.id;
}

/**
 * Uploads a buffer directly as a file to Google Drive folder.
 */
async function uploadToDrive(driveInstance, folderId, fileName, mimeType, buffer) {
  const bodyStream = new Readable();
  bodyStream.push(buffer);
  bodyStream.push(null);

  const fileMetadata = {
    name: fileName,
    parents: [folderId]
  };
  const media = {
    mimeType: mimeType,
    body: bodyStream
  };

  const response = await driveInstance.files.create({
    resource: fileMetadata,
    media: media,
    fields: 'id'
  });
  return response.data.id;
}

/**
 * Local fallback helper: returns a unique directory path on the local disk.
 */
function getUniqueFolderPath(baseStoragePath, bpNumber) {
  const sanitizedBp = bpNumber.replace(/[^a-zA-Z0-9-_]/g, '');
  let folderName = `BP_${sanitizedBp}`;
  let folderPath = path.join(baseStoragePath, folderName);
  
  let counter = 1;
  while (fs.existsSync(folderPath)) {
    folderName = `BP_${sanitizedBp}_${counter}`;
    folderPath = path.join(baseStoragePath, folderName);
    counter++;
  }
  return { folderPath, folderName };
}

/**
 * Generates human-readable recap text file contents.
 */
function generateRecapContent(data, folderName) {
  const dateStr = new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' });
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
        content += `Date de replanification : ${data.replanifierDate || 'Non spécifiée'}\n`;
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
  content += `- Photo des documents : ${data.photoName || 'photo.jpg'}\n`;
  content += `==================================================\n`;
  return content;
}

// POST endpoint to handle prestation submission
app.post('/api/prestation', upload.single('photo'), async (req, res) => {
  try {
    const { bpNumber, prestationFaite } = req.body;
    
    if (!bpNumber) {
      return res.status(400).json({ success: false, error: 'Le numéro de Bon de Prestation (BP) est requis.' });
    }
    
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'La photo des documents de prestation est requise.' });
    }
    
    // Handle potential array or single item for documentsManquants
    let documentsManquants = null;
    if (req.body.documentsManquants) {
      try {
        documentsManquants = JSON.parse(req.body.documentsManquants);
      } catch (e) {
        documentsManquants = req.body.documentsManquants;
      }
    }
    
    const ext = path.extname(req.file.originalname) || '.jpg';
    const photoName = `photo${ext}`;
    
    const submissionData = {
      bpNumber,
      prestationFaite,
      raison: req.body.raison || null,
      replanifier: req.body.replanifier || null,
      replanifierDate: req.body.replanifierDate || null,
      motifPrestationNonFaite: req.body.motifPrestationNonFaite || null,
      documentsManquants,
      actionPrevue: req.body.actionPrevue || null,
      photoName,
      timestamp: new Date().toISOString()
    };
    
    // ----------------------------------------------------
    // CASE A: GOOGLE DRIVE UPLOAD (Cloud Mode)
    // ----------------------------------------------------
    if (drive && parentFolderId) {
      console.log(`[Google Drive] Création du dossier pour BP: ${bpNumber}`);
      
      // Determine a unique folder name on Google Drive
      const folderName = await getUniqueDriveFolderName(drive, parentFolderId, bpNumber);
      
      // Create folder inside Google Drive target parent directory
      const folderId = await createDriveFolder(drive, parentFolderId, folderName);
      
      // Upload the photo
      await uploadToDrive(drive, folderId, photoName, req.file.mimetype, req.file.buffer);
      
      // Upload json data
      const jsonBuffer = Buffer.from(JSON.stringify(submissionData, null, 2), 'utf-8');
      await uploadToDrive(drive, folderId, 'donnees.json', 'application/json', jsonBuffer);
      
      // Upload text report recap
      const recapContent = generateRecapContent(submissionData, folderName);
      const recapBuffer = Buffer.from(recapContent, 'utf-8');
      await uploadToDrive(drive, folderId, 'recapitulatif.txt', 'text/plain', recapBuffer);
      
      console.log(`[Google Drive] Dossier ${folderName} créé avec succès !`);
      
      return res.json({
        success: true,
        message: 'Dossier de prestation créé sur Google Drive.',
        folderName,
        storagePath: `Google Drive / ${folderName}`
      });
    } 
    
    // ----------------------------------------------------
    // CASE B: LOCAL FS WRITE (Fallback Mode)
    // ----------------------------------------------------
    else {
      console.log(`[Local] Création du dossier local pour BP: ${bpNumber}`);
      const { folderPath, folderName } = getUniqueFolderPath(STORAGE_PATH, bpNumber);
      
      fs.mkdirSync(folderPath, { recursive: true });
      
      // Save Photo
      const photoPath = path.join(folderPath, photoName);
      fs.writeFileSync(photoPath, req.file.buffer);
      
      // Save JSON
      fs.writeFileSync(
        path.join(folderPath, 'donnees.json'),
        JSON.stringify(submissionData, null, 2),
        'utf-8'
      );
      
      // Save recap text file
      const recapContent = generateRecapContent(submissionData, folderName);
      fs.writeFileSync(path.join(folderPath, 'recapitulatif.txt'), recapContent, 'utf-8');
      
      console.log(`[Local] Dossier ${folderName} créé en local !`);
      
      return res.json({
        success: true,
        message: 'Dossier de prestation créé en local (fallback).',
        folderName,
        storagePath: folderPath
      });
    }
    
  } catch (error) {
    console.error('❌ Erreur lors du traitement de la prestation:', error);
    res.status(500).json({
      success: false,
      error: 'Une erreur interne est survenue sur le serveur : ' + error.message
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Serveur démarré sur http://localhost:${PORT}`);
  if (drive && parentFolderId) {
    console.log(`Dossiers de prestation enregistrés dans le Google Drive partagé.`);
  } else {
    console.log(`Dossiers de prestation enregistrés dans le répertoire local : ${STORAGE_PATH}`);
  }
});
