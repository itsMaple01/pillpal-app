import { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, TextInput, Image, Alert, Platform, ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import AppIcon from '@/components/AppIcon';
import { theme } from '@/lib/theme';
import { TEXT } from '@/lib/typography';
import { updateUserProfile } from '@/api/index';
import { storage } from '@/lib/firebase';

interface Props {
  visible: boolean;
  uid: string;
  initialName: string;
  initialPhotoUrl?: string | null;
  onClose: () => void;
  onSaved: (data: { full_name: string; profile_picture?: string | null }) => void;
}

async function uploadProfilePhoto(uid: string, uri: string): Promise<string> {
  if (!storage) throw new Error('Storage not available');
  const response = await fetch(uri);
  const blob = await response.blob();
  const photoRef = ref(storage, `profiles/${uid}/avatar.jpg`);
  await uploadBytes(photoRef, blob);
  return getDownloadURL(photoRef);
}

export default function EditProfileModal({
  visible,
  uid,
  initialName,
  initialPhotoUrl,
  onClose,
  onSaved,
}: Props) {
  const [name, setName] = useState(initialName);
  const [photoUrl, setPhotoUrl] = useState<string | null>(initialPhotoUrl ?? null);
  const [localUri, setLocalUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setName(initialName);
      setPhotoUrl(initialPhotoUrl ?? null);
      setLocalUri(null);
    }
  }, [visible, initialName, initialPhotoUrl]);

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow photo library access to update your profile picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      setLocalUri(result.assets[0].uri);
    }
  };

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert('Required', 'Please enter your full name.');
      return;
    }
    setSaving(true);
    try {
      let profile_picture = photoUrl;
      if (localUri) {
        profile_picture = await uploadProfilePhoto(uid, localUri);
      }
      await updateUserProfile(uid, {
        firebase_uid: uid,
        full_name: trimmed,
        profile_picture: profile_picture ?? undefined,
      });
      onSaved({ full_name: trimmed, profile_picture });
      onClose();
    } catch {
      Alert.alert('Error', 'Could not save profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const displayUri = localUri || photoUrl;
  const initial = (name || 'U').charAt(0).toUpperCase();

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.card}>
          <View style={s.header}>
            <Text style={s.title}>Edit Profile</Text>
            <TouchableOpacity onPress={onClose} accessibilityLabel="Close">
              <AppIcon name="close" size={24} color={theme.textMuted} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={s.avatarWrap} onPress={pickPhoto}>
            {displayUri ? (
              <Image source={{ uri: displayUri }} style={s.avatarImg} />
            ) : (
              <View style={s.avatarFallback}>
                <Text style={s.avatarText}>{initial}</Text>
              </View>
            )}
            <Text style={s.changePhoto}>Tap to change photo</Text>
          </TouchableOpacity>

          <Text style={s.label}>Full name *</Text>
          <TextInput
            style={s.input}
            value={name}
            onChangeText={setName}
            placeholder="Your full name"
            placeholderTextColor="#c0c0c0"
            autoCapitalize="words"
          />

          <View style={s.footer}>
            <TouchableOpacity style={s.cancelBtn} onPress={onClose}>
              <Text style={s.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.saveBtn, saving && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={s.saveText}>Save</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 40, 22, 0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: theme.border,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: { fontSize: TEXT.lg, fontWeight: '800', color: theme.text },
  avatarWrap: { alignItems: 'center', marginBottom: 20 },
  avatarImg: { width: 88, height: 88, borderRadius: 44 },
  avatarFallback: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: theme.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 32, fontWeight: '800', color: '#fff' },
  changePhoto: { fontSize: 13, color: theme.green, marginTop: 8, fontWeight: '600' },
  label: { fontSize: 12, fontWeight: '700', color: '#888', marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: theme.text,
    marginBottom: 20,
  },
  footer: { flexDirection: 'row', gap: 12 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  cancelText: { fontSize: 15, fontWeight: '700', color: '#666' },
  saveBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: theme.green,
  },
  saveText: { fontSize: 15, fontWeight: '800', color: '#fff' },
});
