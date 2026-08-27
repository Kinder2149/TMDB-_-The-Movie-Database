package com.kinder.suivifilmsseries;

import androidx.annotation.NonNull;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.auth.api.identity.AuthorizationRequest;
import com.google.android.gms.auth.api.identity.AuthorizationResult;
import com.google.android.gms.auth.api.identity.Identity;
import com.google.android.gms.common.api.Scope;

import java.util.Collections;

/**
 * Renouveler l'autorisation d'écrire dans le Drive, sans réidentifier l'utilisateur.
 *
 * <p>Google sépare deux étapes : « qui es-tu » (l'écran de compte, toujours affiché) et
 * « as-tu le droit d'écrire ici » (silencieuse une fois accordée). Le composant de
 * connexion qu'utilise l'application enchaîne les deux et ne propose que le paquet
 * complet : c'est pour ça qu'un écran Google apparaissait à chaque renouvellement, et
 * donc pourquoi aucune sauvegarde ne pouvait partir toute seule.
 *
 * <p>Ce fichier n'ouvre que la deuxième étape. L'identité, on la connaît déjà : elle est
 * enregistrée sur l'appareil au moment de la connexion, que l'utilisateur a faite lui-même.
 *
 * <p>Volontairement, <b>aucune interface n'est affichée ici</b>. Si Google réclame un
 * accord (première fois, ou autorisation révoquée), on renvoie
 * {@code granted: false, needsConsent: true} et c'est à l'application de décider
 * d'interrompre l'utilisateur — ce qu'une sauvegarde automatique ne doit jamais faire.
 */
@CapacitorPlugin(name = "DriveAuth")
public class DriveAuthPlugin extends Plugin {

    @PluginMethod
    public void authorize(PluginCall call) {
        String scope = call.getString("scope");
        if (scope == null || scope.isEmpty()) {
            call.reject("Portée manquante.");
            return;
        }

        AuthorizationRequest request = AuthorizationRequest
            .builder()
            .setRequestedScopes(Collections.singletonList(new Scope(scope)))
            .build();

        Identity
            .getAuthorizationClient(getActivity())
            .authorize(request)
            .addOnSuccessListener(result -> call.resolve(reponse(result)))
            .addOnFailureListener(erreur ->
                call.reject(erreur.getMessage() != null ? erreur.getMessage() : "Autorisation refusée.")
            );
    }

    @NonNull
    private JSObject reponse(@NonNull AuthorizationResult result) {
        JSObject reponse = new JSObject();
        // hasResolution() = Google veut montrer un écran avant d'accorder quoi que ce
        // soit. On ne le lance pas : on le signale, et on repart sans jeton.
        if (result.hasResolution()) {
            reponse.put("granted", false);
            reponse.put("needsConsent", true);
            return reponse;
        }
        String accessToken = result.getAccessToken();
        reponse.put("granted", accessToken != null);
        reponse.put("needsConsent", false);
        reponse.put("accessToken", accessToken);
        return reponse;
    }
}
