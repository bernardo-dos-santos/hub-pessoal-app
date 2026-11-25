package com.bernardo.hubpessoal;

import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInstaller;
import android.util.Log;

import androidx.core.app.NotificationCompat;

/**
 * Two moments of the self-update (AppUpdatePlugin):
 *
 * - the PackageInstaller session's status: when Android wants the user to
 *   confirm (the first update, or an Android older than 12), its confirmation
 *   screen comes in this intent and has to be started from here;
 * - MY_PACKAGE_REPLACED: the update installed and the old process is gone.
 *   Android doesn't reopen the app, so a notification says it's done and opens
 *   the new version on tap.
 */
public class InstallStatusReceiver extends BroadcastReceiver {

    private static final String CHANNEL_ID = "hub"; // created by nativePush.ts
    private static final int UPDATED_NOTIFICATION_ID = 4201;

    @Override
    public void onReceive(Context context, Intent intent) {
        if (Intent.ACTION_MY_PACKAGE_REPLACED.equals(intent.getAction())) {
            notifyUpdated(context);
            return;
        }
        int status = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE);
        if (status == PackageInstaller.STATUS_PENDING_USER_ACTION) {
            Intent confirm = intent.getParcelableExtra(Intent.EXTRA_INTENT);
            if (confirm != null) {
                confirm.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(confirm);
            }
        } else if (status != PackageInstaller.STATUS_SUCCESS) {
            Log.w("HubUpdate", "Instalação falhou: " + intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE));
        }
    }

    private void notifyUpdated(Context context) {
        Intent open = new Intent(context, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        PendingIntent tap = PendingIntent.getActivity(context, 0, open, PendingIntent.FLAG_IMMUTABLE);
        NotificationCompat.Builder notification = new NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_hub)
            .setColor(context.getResources().getColor(R.color.hub_notification, null))
            .setContentTitle("Olimpo atualizado")
            .setContentText("A versão nova já está instalada — toque para abrir.")
            .setContentIntent(tap)
            .setAutoCancel(true);
        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null) manager.notify(UPDATED_NOTIFICATION_ID, notification.build());
    }
}
