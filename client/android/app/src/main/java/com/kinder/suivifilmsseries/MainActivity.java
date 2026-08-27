package com.kinder.suivifilmsseries;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Seule pièce écrite spécialement pour Android : renouveler l'autorisation
        // d'écrire dans le Drive sans réafficher l'écran de compte Google.
        registerPlugin(DriveAuthPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
