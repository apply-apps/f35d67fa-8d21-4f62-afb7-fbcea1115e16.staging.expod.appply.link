// App.js
import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TextInput, Button, Image, ScrollView, Alert, TouchableOpacity, Switch } from 'react-native';
import { Camera } from 'expo-camera';
import * as Location from 'expo-location';
import { BarCodeScanner } from 'expo-barcode-scanner';
import axios from 'axios';
import { Picker } from '@react-native-picker/picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import { Signature } from 'react-native-signature-canvas';

const API_URL = 'https://apihub.staging.appply.link/chatgpt';

const App = () => {
  const [user, setUser] = useState(null);
  const [companyInfo, setCompanyInfo] = useState({
    name: '',
    street: '',
    streetNumber: '',
    zipCode: '',
    city: '',
  });

  const [contactInfo, setContactInfo] = useState({
    name: '',
    email: '',
    phone: '',
  });

  const [meters, setMeters] = useState([]);
  const [currentMeter, setCurrentMeter] = useState({
    count: 0,
    location: null,
    timestamp: null,
    meterPhoto: null,
    distancePhoto: null,
    scannedCode: null,
    energyType: '',
  });

  const [cameraPermission, setCameraPermission] = useState(null);
  const [locationPermission, setLocationPermission] = useState(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [activePhotoType, setActivePhotoType] = useState(null);
  const [isAllMetersCollected, setIsAllMetersCollected] = useState(false);
  const [signature, setSignature] = useState(null);
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredCompanies, setFilteredCompanies] = useState([]);

  const cameraRef = useRef(null);

  useEffect(() => {
    (async () => {
      const { status: cameraStatus } = await Camera.requestCameraPermissionsAsync();
      setCameraPermission(cameraStatus === 'granted');

      const { status: locationStatus } = await Location.requestForegroundPermissionsAsync();
      setLocationPermission(locationStatus === 'granted');

      const storedUser = await AsyncStorage.getItem('user');
      if (storedUser) {
        setUser(JSON.parse(storedUser));
      }

      const storedData = await AsyncStorage.getItem('offlineData');
      if (storedData) {
        const parsedData = JSON.parse(storedData);
        setCompanyInfo(parsedData.companyInfo);
        setContactInfo(parsedData.contactInfo);
        setMeters(parsedData.meters);
      }
    })();
  }, []);

  const handleCompanyInfoChange = (field, value) => {
    setCompanyInfo(prevState => ({ ...prevState, [field]: value }));
  };

  const handleContactInfoChange = (field, value) => {
    setContactInfo(prevState => ({ ...prevState, [field]: value }));
  };

  const handleTakePicture = async (type) => {
    if (cameraPermission) {
      setIsCameraActive(true);
      setActivePhotoType(type);
    } else {
      Alert.alert('Keine Kameraberechtigung', 'Bitte erteilen Sie die Kameraberechtigung in den Einstellungen.');
    }
  };

  const takePicture = async () => {
    if (cameraRef.current) {
      const photo = await cameraRef.current.takePictureAsync();
      setCurrentMeter(prevState => ({ ...prevState, [activePhotoType]: photo.uri }));
      setIsCameraActive(false);
      setActivePhotoType(null);
    }
  };

  const handleScanCode = async () => {
    setIsScanning(true);
  };

  const handleBarCodeScanned = ({ data }) => {
    setCurrentMeter(prevState => ({ ...prevState, scannedCode: data }));
    setIsScanning(false);
  };

  const handleGetLocation = async () => {
    if (locationPermission) {
      const location = await Location.getCurrentPositionAsync({});
      setCurrentMeter(prevState => ({
        ...prevState,
        location: `${location.coords.latitude}, ${location.coords.longitude}`,
        timestamp: new Date().toISOString(),
      }));
    } else {
      Alert.alert('Keine Standortberechtigung', 'Bitte erteilen Sie die Standortberechtigung in den Einstellungen.');
    }
  };

  const handleAddMeter = () => {
    setMeters(prevMeters => [...prevMeters, currentMeter]);
    setCurrentMeter({
      count: 0,
      location: null,
      timestamp: null,
      meterPhoto: null,
      distancePhoto: null,
      scannedCode: null,
      energyType: '',
    });
  };

  const handleSubmit = async () => {
    if (!isAllMetersCollected) {
      Alert.alert('Warnung', 'Bitte bestätigen Sie, dass alle Zähler vollständig erfasst wurden.');
      return;
    }

    if (!signature) {
      Alert.alert('Warnung', 'Bitte unterschreiben Sie die Datenschutzerklärung.');
      return;
    }

    const data = {
      companyInfo,
      contactInfo,
      meters,
    };

    try {
      const response = await axios.post(API_URL, {
        messages: [
          { role: "system", content: "Sie sind ein hilfreicher Assistent. Bitte formatieren Sie die folgenden Daten für eine Google-Tabelle." },
          { role: "user", content: JSON.stringify(data) }
        ],
        model: "gpt-4o"
      });

      const formattedData = response.data.response;
      console.log('Formatierte Daten für Google-Tabelle:', formattedData);

      // Hier würde der tatsächliche Export zu Google Sheets stattfinden

      // E-Mail-Benachrichtigung senden
      await sendEmailNotification(contactInfo.email);

      Alert.alert('Erfolg', 'Daten wurden erfolgreich exportiert. Eine Benachrichtigung wurde an Ihre E-Mail-Adresse gesendet.');

      // Offline-Daten löschen
      await AsyncStorage.removeItem('offlineData');

      // Daten zurücksetzen
      setCompanyInfo({
        name: '',
        street: '',
        streetNumber: '',
        zipCode: '',
        city: '',
      });
      setContactInfo({
        name: '',
        email: '',
        phone: '',
      });
      setMeters([]);
      setSignature(null);
      setIsAllMetersCollected(false);

    } catch (error) {
      console.error('Fehler beim Exportieren der Daten:', error);
      Alert.alert('Fehler', 'Es gab ein Problem beim Exportieren der Daten. Die Daten werden lokal gespeichert und später synchronisiert.');
      
      // Daten lokal speichern
      await AsyncStorage.setItem('offlineData', JSON.stringify({ companyInfo, contactInfo, meters }));
    }
  };

  const sendEmailNotification = async (email) => {
    // Hier würde der Code zur Versendung der E-Mail-Benachrichtigung stehen
    console.log(`E-Mail-Benachrichtigung gesendet an: ${email}`);
  };

  const handleSignature = (signature) => {
    setSignature(signature);
  };

  const handleSearch = (query) => {
    setSearchQuery(query);
    const filtered = meters.filter(meter => 
      meter.scannedCode.includes(query) || 
      meter.energyType.toLowerCase().includes(query.toLowerCase())
    );
    setFilteredCompanies(filtered);
  };

  const handleRegister = async () => {
    const newUser = {
      id: Date.now().toString(),
      name: 'Neuer Benutzer',
      email: 'benutzer@example.com',
      code: generateUserCode(),
    };
    await AsyncStorage.setItem('user', JSON.stringify(newUser));
    setUser(newUser);
  };

  const generateUserCode = () => {
    return Math.random().toString(36).substr(2, 8).toUpperCase();
  };

  const handleLogout = async () => {
    await AsyncStorage.removeItem('user');
    setUser(null);
  };

  if (!user) {
    return (
      <View style={styles.container}>
        <Text>Bitte registrieren Sie sich, um fortzufahren.</Text>
        <Button title="Registrieren" onPress={handleRegister} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Image
        source={{ uri: 'https://picsum.photos/200/300' }}
        style={styles.logo}
      />
      
      <Text>Willkommen, {user.name}</Text>
      <Text>Ihr Benutzercode: {user.code}</Text>
      <Button title="Abmelden" onPress={handleLogout} />

      <Text style={styles.header}>Unternehmensinformationen</Text>
      <TextInput
        style={styles.input}
        placeholder="Firmenname"
        value={companyInfo.name}
        onChangeText={(text) => handleCompanyInfoChange('name', text)}
      />
      <TextInput
        style={styles.input}
        placeholder="Straße"
        value={companyInfo.street}
        onChangeText={(text) => handleCompanyInfoChange('street', text)}
      />
      <TextInput
        style={styles.input}
        placeholder="Hausnummer"
        value={companyInfo.streetNumber}
        onChangeText={(text) => handleCompanyInfoChange('streetNumber', text)}
      />
      <TextInput
        style={styles.input}
        placeholder="PLZ"
        value={companyInfo.zipCode}
        onChangeText={(text) => handleCompanyInfoChange('zipCode', text)}
      />
      <TextInput
        style={styles.input}
        placeholder="Ort"
        value={companyInfo.city}
        onChangeText={(text) => handleCompanyInfoChange('city', text)}
      />

      <Text style={styles.header}>Kontaktinformationen</Text>
      <TextInput
        style={styles.input}
        placeholder="Name"
        value={contactInfo.name}
        onChangeText={(text) => handleContactInfoChange('name', text)}
      />
      <TextInput
        style={styles.input}
        placeholder="E-Mail"
        value={contactInfo.email}
        onChangeText={(text) => handleContactInfoChange('email', text)}
      />
      <TextInput
        style={styles.input}
        placeholder="Telefon"
        value={contactInfo.phone}
        onChangeText={(text) => handleContactInfoChange('phone', text)}
      />

      <Text style={styles.header}>Zählerinformationen</Text>
      <Button title="Zählerfoto aufnehmen" onPress={() => handleTakePicture('meterPhoto')} />
      <Button title="Abstandsfoto aufnehmen" onPress={() => handleTakePicture('distancePhoto')} />
      <Button title="Code scannen" onPress={handleScanCode} />
      <Button title="Standort erfassen" onPress={handleGetLocation} />
      
      <Picker
        selectedValue={currentMeter.energyType}
        style={styles.picker}
        onValueChange={(itemValue) => setCurrentMeter(prevState => ({ ...prevState, energyType: itemValue }))}
      >
        <Picker.Item label="Energieart wählen" value="" />
        <Picker.Item label="Strom" value="Strom" />
        <Picker.Item label="Wärme" value="Wärme" />
        <Picker.Item label="Wasser" value="Wasser" />
      </Picker>

      <Button title="Zähler hinzufügen" onPress={handleAddMeter} />

      <Text style={styles.header}>Erfasste Zähler: {meters.length}</Text>

      <View style={styles.checkboxContainer}>
        <Switch
          value={isAllMetersCollected}
          onValueChange={setIsAllMetersCollected}
        />
        <Text style={styles.checkboxLabel}>Sind alle Zähler vollständig erfasst?</Text>
      </View>

      <Button title="Datenschutzerklärung anzeigen" onPress={() => setShowPrivacyPolicy(true)} />

      {showPrivacyPolicy && (
        <View>
          <Text style={styles.privacyPolicy}>
            Hier steht der Text der Datenschutzerklärung...
          </Text>
          <Button title="Schließen" onPress={() => setShowPrivacyPolicy(false)} />
        </View>
      )}

      <View style={styles.signatureContainer}>
        <Text>Bitte unterschreiben Sie hier:</Text>
        <Signature
          onOK={handleSignature}
          descriptionText="Unterschrift"
          clearText="Löschen"
          confirmText="Speichern"
        />
      </View>

      <Button title="Daten exportieren" onPress={handleSubmit} />

      <Text style={styles.header}>Suche</Text>
      <TextInput
        style={styles.input}
        placeholder="Suche nach Zählercode oder Energieart"
        value={searchQuery}
        onChangeText={handleSearch}
      />

      {filteredCompanies.map((meter, index) => (
        <View key={index} style={styles.meterItem}>
          <Text>Code: {meter.scannedCode}</Text>
          <Text>Energieart: {meter.energyType}</Text>
        </View>
      ))}

      {isCameraActive && (
        <View style={styles.cameraContainer}>
          <Camera
            style={styles.camera}
            type={Camera.Constants.Type.back}
            ref={cameraRef}
          >
            <View style={styles.buttonContainer}>
              <TouchableOpacity style={styles.button} onPress={takePicture}>
                <Text style={styles.buttonText}>Foto aufnehmen</Text>
              </TouchableOpacity>
            </View>
          </Camera>
        </View>
      )}

      {isScanning && (
        <BarCodeScanner
          onBarCodeScanned={handleBarCodeScanned}
          style={StyleSheet.absoluteFillObject}
        />
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  logo: {
    width: 100,
    height: 100,
    alignSelf: 'center',
    marginBottom: 20,
  },
  header: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 10,
  },
  input: {
    height: 40,
    borderColor: 'gray',
    borderWidth: 1,
    marginBottom: 10,
    paddingHorizontal: 10,
  },
  picker: {
    height: 50,
    width: '100%',
    marginBottom: 10,
  },
  cameraContainer: {
    flex: 1,
    flexDirection: 'column',
    backgroundColor: 'black',
    aspectRatio: 1,
  },
  camera: {
    flex: 1,
  },
  buttonContainer: {
    flex: 1,
    backgroundColor: 'transparent',
    flexDirection: 'row',
    justifyContent: 'center',
    margin: 20,
  },
  button: {
    flex: 0.1,
    alignSelf: 'flex-end',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 10,
    borderRadius: 5,
  },
  buttonText: {
    fontSize: 14,
    color: 'black',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  checkboxLabel: {
    marginLeft: 8,
  },
  privacyPolicy: {
    marginTop: 10,
    marginBottom: 10,
  },
  signatureContainer: {
    height: 200,
    marginTop: 15,
  },
  meterItem: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 10,
    marginBottom: 10,
  },
});

export default App;
// End of App.js