import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Alert, Platform } from 'react-native';

interface MedicationRecord {
  date: string;
  medicationName: string;
  dosage: string;
  time: string;
  status: 'taken' | 'missed' | 'late' | 'pending';
}

interface ConnectedAccount {
  id: string;
  name: string;
  type: 'family' | 'caretaker' | 'patient';
  email?: string;
}

interface ExportData {
  exportDate: string;
  user: {
    name: string;
    email: string;
    role: string;
  };
  medications: MedicationRecord[];
  connectedAccounts: ConnectedAccount[];
  statistics: {
    total: number;
    taken: number;
    missed: number;
    late: number;
    pending: number;
    complianceRate: number;
  };
}

function sanitizeFileName(exportDate: string, extension: 'csv' | 'json'): string {
  const safeDate = exportDate.replace(/[^0-9-]/g, '') || 'export';
  return `gabayra-export-${safeDate}.${extension}`;
}

async function writeAndShareMobileFile(
  fileName: string,
  content: string,
  mimeType: string,
  dialogTitle: string,
): Promise<void> {
  const file = new File(Paths.cache, fileName);

  try {
    if (file.exists) {
      file.delete();
    }
    file.create();
    file.write(content);

    if (!file.exists || file.size === 0) {
      throw new Error(`Export file was not written: ${file.uri}`);
    }

    console.log('[export] File written:', file.uri, 'bytes:', file.size, 'platform:', Platform.OS);

    const sharingAvailable = await Sharing.isAvailableAsync();
    console.log('[export] Sharing available:', sharingAvailable);

    if (!sharingAvailable) {
      throw new Error('Sharing is not available on this device');
    }

    await Sharing.shareAsync(file.uri, {
      mimeType,
      dialogTitle,
      UTI: mimeType === 'text/csv' ? 'public.comma-separated-values-text' : 'public.json',
    });

    console.log('[export] Share sheet opened successfully');
  } catch (err) {
    console.error('[export] Mobile export failed:', {
      fileName,
      mimeType,
      platform: Platform.OS,
      error: err,
    });
    throw err;
  }
}

export function confirmAndExportCSV(data: ExportData): Promise<void> {
  return new Promise((resolve, reject) => {
    const run = () => {
      exportDataToCSV(data).then(resolve).catch(reject);
    };

    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm('Are you sure you want to export your medication data?')) {
        run();
      } else {
        resolve();
      }
      return;
    }

    Alert.alert(
      'Export Data',
      'Are you sure you want to export your medication data?',
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve() },
        { text: 'Confirm', onPress: run },
      ],
    );
  });
}

export async function exportDataToCSV(data: ExportData): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      const csvContent = generateCSV(data);
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', sanitizeFileName(data.exportDate, 'csv'));
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      console.log('[export] CSV export successful (web)');
    } catch (err) {
      console.error('[export] CSV export failed (web):', err);
      throw err;
    }
    return;
  }

  const csvContent = generateCSV(data);
  const fileName = sanitizeFileName(data.exportDate, 'csv');
  await writeAndShareMobileFile(
    fileName,
    csvContent,
    'text/csv',
    'Export your medication data',
  );
}

function generateCSV(data: ExportData): string {
  let csv = 'GabayRa Medication Data Export\n';
  csv += `Export Date: ${data.exportDate}\n`;
  csv += `User: ${data.user.name} (${data.user.email || 'N/A'})\n`;
  csv += `Role: ${data.user.role}\n\n`;

  csv += 'Statistics\n';
  csv += 'Total Medications,Taken,Missed,Late,Pending,Compliance Rate\n';
  csv += `${data.statistics.total},${data.statistics.taken},${data.statistics.missed},${data.statistics.late},${data.statistics.pending},${data.statistics.complianceRate}%\n\n`;

  csv += 'Connected Accounts\n';
  csv += 'Name,Type,Email\n';
  if (data.connectedAccounts.length === 0) {
    csv += 'No connected accounts\n';
  } else {
    data.connectedAccounts.forEach(account => {
      csv += `${account.name},${account.type},${account.email || 'N/A'}\n`;
    });
  }

  csv += '\nMedication Records\n';
  csv += 'Date,Medication Name,Dosage,Time,Status\n';
  if (data.medications.length === 0) {
    csv += 'No medication records\n';
  } else {
    data.medications.forEach(record => {
      csv += `${record.date},${record.medicationName},${record.dosage},${record.time},${record.status}\n`;
    });
  }

  return csv;
}

export async function exportDataToJSON(data: ExportData): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      const jsonContent = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonContent], { type: 'application/json' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', sanitizeFileName(data.exportDate, 'json'));
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      console.log('[export] JSON export successful (web)');
    } catch (err) {
      console.error('[export] JSON export failed (web):', err);
      throw err;
    }
    return;
  }

  const jsonContent = JSON.stringify(data, null, 2);
  const fileName = sanitizeFileName(data.exportDate, 'json');
  await writeAndShareMobileFile(
    fileName,
    jsonContent,
    'application/json',
    'Export your medication data',
  );
}
