# School Management App - Flutter Guide

## 🎯 यह App क्या करेगी?

यह एक **Offline School Management App** है जो:
- Android Phone पर APK के रूप में install होगी
- Windows PC पर EXE के रूप में install होगी
- सारा data locally (phone/PC में) store होगा
- Internet के बिना काम करेगी

## 📋 Features

### 1. Core Setup
- ✅ Offline Database (SQLite)
- ✅ Multi-school capability (School Profile Setup)
- ✅ Login System (Admin/Staff)

### 2. Student Management
- ✅ Master Entry (LKG-12, Section, Aadhaar, Category)
- ✅ ID Card Generator (Printable PDF)
- 🔜 Session Promotion (Next class promotion with fail checkbox)
- 🔜 TC/Character Certificate Generator

### 3. Fees Management
- ✅ Class-wise Fee Structure
- ✅ Monthly Fee Collection with Receipt
- ✅ WhatsApp Integration (Share receipt)
- ✅ Defaulter List with filters

### 4. Staff Management
- ✅ Teacher/Staff Master
- 🔜 Salary System
- 🔜 Advance Management

---

## 🚀 Setup Instructions (अपने PC पर कैसे बनाएं)

### Step 1: Flutter Install करें

1. **Flutter SDK Download करें:**
   - https://flutter.dev/docs/get-started/install/windows पर जाएं
   - Flutter SDK zip download करें
   - `C:\flutter` में extract करें

2. **Environment Variable Set करें:**
   - System Properties > Environment Variables
   - Path में `C:\flutter\bin` add करें

3. **Check करें:**
   ```bash
   flutter doctor
   ```

### Step 2: VS Code Setup

1. **VS Code Install करें:** https://code.visualstudio.com/
2. **Extensions Install करें:**
   - Flutter
   - Dart

### Step 3: Project Create करें

```bash
flutter create school_management
cd school_management
```

### Step 4: Files Copy करें

इस guide के सारे files को अपने project में copy करें:

```
school_management/
├── lib/
│   ├── main.dart
│   ├── database/
│   │   └── database_helper.dart
│   ├── models/
│   │   └── student.dart
│   ├── providers/
│   │   ├── school_provider.dart
│   │   ├── student_provider.dart
│   │   ├── fee_provider.dart
│   │   └── staff_provider.dart
│   └── screens/
│       ├── splash_screen.dart
│       ├── login_screen.dart
│       ├── dashboard_screen.dart
│       ├── students/
│       │   ├── student_list_screen.dart
│       │   ├── add_student_screen.dart
│       │   └── id_card_screen.dart
│       ├── fees/
│       │   ├── fee_collection_screen.dart
│       │   └── defaulters_screen.dart
│       ├── staff/
│       │   └── staff_list_screen.dart
│       └── settings/
│           └── school_settings_screen.dart
├── pubspec.yaml
└── README.md
```

### Step 5: Dependencies Install करें

```bash
flutter pub get
```

### Step 6: Run करें

```bash
# Android पर run करें
flutter run

# Windows पर run करें
flutter run -d windows
```

---

## 📱 APK Build करें (Android के लिए)

```bash
flutter build apk --release
```

APK यहाँ मिलेगी: `build/app/outputs/flutter-apk/app-release.apk`

---

## 💻 EXE Build करें (Windows के लिए)

```bash
flutter build windows --release
```

EXE यहाँ मिलेगी: `build/windows/runner/Release/`

---

## 🔑 Default Login

- **Username:** admin
- **Password:** admin123

---

## 📞 Support

अगर कोई problem हो तो आप मुझसे पूछ सकते हैं!

---

## 🔮 Future Features (Version 2.0)

1. Attendance Management
2. Exam & Results
3. Library Management
4. Transport Management
5. SMS Integration
6. Data Sync to Cloud (Optional)
