import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

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

export async function exportDataToCSV(data: ExportData): Promise<void> {
  if (Platform.OS === 'web') {
    // Web implementation
    try {
      const csvContent = generateCSV(data);
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `gabayra-export-${data.exportDate}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      console.log('CSV export successful (web)');
    } catch (err) {
      console.error('CSV export failed (web):', err);
      throw err;
    }
    return;
  }

  // Mobile implementation
  try {
    const csvContent = generateCSV(data);
    const fileName = `gabayra-export-${data.exportDate}.csv`;
    const fileUri = FileSystem.documentDirectory + fileName;

    console.log('Writing CSV file to:', fileUri);
    await FileSystem.writeAsStringAsync(fileUri, csvContent, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    console.log('CSV file written successfully');

    if (await Sharing.isAvailableAsync()) {
      console.log('Sharing CSV file');
      await Sharing.shareAsync(fileUri, {
        mimeType: 'text/csv',
        dialogTitle: 'Export your medication data',
      });
      console.log('CSV file shared successfully');
    } else {
      console.error('Sharing not available on this device');
    }
  } catch (err) {
    console.error('CSV export failed (mobile):', err);
    throw err;
  }
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
      link.setAttribute('download', `gabayra-export-${data.exportDate}.json`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      console.log('JSON export successful (web)');
    } catch (err) {
      console.error('JSON export failed (web):', err);
      throw err;
    }
    return;
  }

  try {
    const jsonContent = JSON.stringify(data, null, 2);
    const fileName = `gabayra-export-${data.exportDate}.json`;
    const fileUri = FileSystem.documentDirectory + fileName;

    console.log('Writing JSON file to:', fileUri);
    await FileSystem.writeAsStringAsync(fileUri, jsonContent, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    console.log('JSON file written successfully');

    if (await Sharing.isAvailableAsync()) {
      console.log('Sharing JSON file');
      await Sharing.shareAsync(fileUri, {
        mimeType: 'application/json',
        dialogTitle: 'Export your medication data',
      });
      console.log('JSON file shared successfully');
    } else {
      console.error('Sharing not available on this device');
    }
  } catch (err) {
    console.error('JSON export failed (mobile):', err);
    throw err;
  }
}
