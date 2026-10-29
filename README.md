# 📢 CampusVoice.ai

> **The AI-Powered Grievance Intelligence System**  
> Transforming scattered campus complaints into structured, actionable data.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)
![React](https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)
![Android](https://img.shields.io/badge/Android-3DDC84?style=for-the-badge&logo=android&logoColor=white)

CampusVoice is a production-ready, cross-platform intelligence portal designed to bridge the gap between student feedback and administrative action. By utilizing advanced vector embeddings, the platform prevents administrative fatigue by autonomously identifying and merging semantically identical grievances in real-time.

## 🚀 Live Demo & Native App

Experience the platform live on the web or download the fully native Android application:
* **Web Platform:** [campus-voice-phi.vercel.app](https://campus-voice-phi.vercel.app)
* **Android APK:** Click the "Get the Android App" button directly on the web login screen to download the native application.

## ✨ Core Architecture

* **🧠 Semantic AI Grouping:** Powered by Google's Gemini `text-embedding-004` model (3072 dimensions) to instantly detect contextual overlap and deduplicate reports (e.g., merging "Wi-Fi is down" with "No internet access on floor 2").
* **📱 Native Mobile Experience:** Wrapped via Capacitor, delivering a highly responsive UI and native Android OS Google Authentication.
* **📊 Administrative Intelligence:** A live-updating analytics dashboard providing category breakdowns, resolution tracking, and campus-wide trend analysis.
* **🔒 Enterprise Security:** Fortified by Supabase Row Level Security (RLS), ensuring strict data isolation between student submissions and administrative privileges.

## 🛠 Tech Stack

* **Frontend:** React (Vite), Tailwind CSS, Lucide Icons
* **Backend & Database:** Supabase (PostgreSQL with `pgvector` extension)
* **AI Engine:** Google Gemini API (Vector Embeddings)
* **Mobile Compilation:** Capacitor, Android Studio
* **Authentication:** Native Google Sign-In & `@react-oauth/google`
* **Cloud Hosting:** Vercel

## 🌍 Live Deployment & Platform Access

CampusVoice is actively hosted in a production environment. Evaluators and users can interact with the live platform immediately without any local repository configuration.

* **💻 Cloud Web Portal:** Access the fully responsive administrative and student dashboard directly at [campus-voice-phi.vercel.app](https://campus-voice-phi.vercel.app).
* **📱 Native Android Application:** To evaluate the mobile-optimized native build, navigate to the web portal on any Android device and select **Get the Android App** from the authentication interface. The production APK is securely hosted and distributed via our Vercel edge network.

---
*Engineered to build a better, more responsive campus.*