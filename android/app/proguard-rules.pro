# The app code and org.json use no reflection. Libraries that do:

# WorkManager (background alerts check) keeps its jobs in a Room database, which Room creates by
# reflection from its no-argument constructor. Without this the release build crashes at launch:
# "NoSuchMethodException: androidx.work.impl.WorkDatabase_Impl.<init> []".
-keep class * extends androidx.room.RoomDatabase { <init>(); }

# WorkManager also creates the alerts worker by reflection, from its class name and
# (Context, WorkerParameters) constructor.
-keep class * extends androidx.work.ListenableWorker { <init>(android.content.Context, androidx.work.WorkerParameters); }
