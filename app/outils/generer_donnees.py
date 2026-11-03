# -*- coding: utf-8 -*-
"""Lit le dossier listes/ (et consignes/) et produit app/donnees.js pour l'app web.

A lancer avec mettre-a-jour.cmd apres chaque ajout ou modification d'une liste.
Le fichier produit (app/donnees.js) ne doit pas etre modifie a la main.
"""
import csv
import json
import os
import re
import sys
import unicodedata
from datetime import datetime

EXTENSIONS_AUDIO = (".mp3", ".wav")
IDS_ATTENDUS = [
    "1", "2", "3", "4a", "4b", "5a", "5b", "6a", "6b",
    "7", "8", "9", "10", "11", "12", "13",
    "14-15",
    "16", "17", "18", "19", "20", "21", "22", "23", "24", "25", "26", "27",
    "28", "29", "30", "31", "32", "33", "34", "35", "36",
]
SECTIONS = {"pièges": "pieges", "pieges": "pieges", "variantes": "variantes"}
CHAMPS = {"titre court": "titreCourt", "titre": "titre", "description": "description"}

avertissements = []


def nfc(texte):
    return unicodedata.normalize("NFC", texte)


def cle_naturelle(nom):
    morceaux = re.split(r"(\d+)", nom)
    return [(0, int(m), "") if m.isdigit() else (1, 0, m.casefold()) for m in morceaux if m != ""]


def audios_du_dossier(dossier):
    """Retourne {mot: nom_de_fichier} pour les audios directement dans le dossier."""
    resultat = {}
    if not os.path.isdir(dossier):
        return resultat
    for nom in os.listdir(dossier):
        chemin = os.path.join(dossier, nom)
        if os.path.isfile(chemin) and nom.lower().endswith(EXTENSIONS_AUDIO):
            mot = nfc(os.path.splitext(nom)[0])
            if mot in resultat:
                avertissements.append(f"{os.path.basename(os.path.dirname(dossier))}/{os.path.basename(dossier)} : deux fichiers audio pour le mot « {mot} » ; un seul est utilisé.")
                continue
            resultat[mot] = nom
    return resultat


def lire_lignes(chemin):
    with open(chemin, "r", encoding="utf-8-sig") as f:
        return [nfc(l.rstrip("\r\n")) for l in f]


def segments(brut, contexte):
    """'tr[ai]n[er]' -> [['tr',0],['ai',1],['n',0],['er',1]]"""
    if brut.count("[") != brut.count("]") or re.search(r"\[[^\]]*\[|\][^\[]*\]", brut):
        avertissements.append(f"{contexte} : crochets mal fermés dans « {brut} » ; surlignage ignoré.")
        return [[brut.replace("[", "").replace("]", ""), 0]]
    parts = [p for p in re.split(r"(\[[^\]]+\])", brut) if p]
    return [[p[1:-1], 1] if p.startswith("[") else [p, 0] for p in parts]


def lire_bloc_txt(chemin, mots_audio, id_liste):
    fiche = {"titreCourt": "", "titre": "", "description": "", "pieges": {}, "variantes": {}, "sansAudio": []}
    if not os.path.isfile(chemin):
        avertissements.append(f"Bloc {id_liste} : pas de bloc.txt (thème et pièges absents).")
        return fiche
    section = None
    for num, ligne in enumerate(lire_lignes(chemin), 1):
        brut = ligne.strip()
        if not brut or brut.startswith("#"):
            continue
        ctx = f"Bloc {id_liste}, bloc.txt ligne {num}"
        if ":" in brut and not brut.endswith(":"):
            cle, _, valeur = brut.partition(":")
            cle_n = cle.strip().lower()
            if cle_n in CHAMPS and section is None:
                fiche[CHAMPS[cle_n]] = valeur.strip()
                continue
        if brut.endswith(":") and brut[:-1].strip().lower() in CHAMPS and section is None:
            continue  # champ laisse vide (ex. « Description : »)
        if brut.endswith(":") and brut[:-1].strip().lower() in SECTIONS:
            section = SECTIONS[brut[:-1].strip().lower()]
            continue
        if section == "pieges":
            mot = re.sub(r"\s+", " ", brut.replace("[", "").replace("]", "")).strip()
            if mot not in mots_audio:
                fiche["sansAudio"].append(mot)
                continue
            fiche["pieges"][mot] = segments(brut, ctx)
        elif section == "variantes":
            if "=" not in brut:
                avertissements.append(f"{ctx} : variante sans « = » ; ligne ignorée.")
                continue
            mot, _, reste = brut.partition("=")
            mot = mot.strip()
            if mot not in mots_audio:
                if mot not in fiche["sansAudio"]:  # mot prevu mais pas encore genere : pas d'avertissement
                    avertissements.append(f"{ctx} : variante pour « {mot} », qui n'a pas de fichier audio ; ligne ignorée.")
                continue
            liste = [v.strip() for v in reste.split(";") if v.strip()]
            fiche["variantes"].setdefault(mot, []).extend(liste)
        else:
            avertissements.append(f"{ctx} : ligne non reconnue : « {brut} ».")
    if fiche["sansAudio"]:
        avertissements.append(f"Bloc {id_liste} : {len(fiche['sansAudio'])} mot(s) de bloc.txt sans fichier audio (voir audio-a-generer.csv) : " + ", ".join(fiche["sansAudio"]) + ".")
    if not fiche["titreCourt"]:
        avertissements.append(f"Bloc {id_liste} : « Titre court » manquant dans bloc.txt.")
    return fiche


def lire_phrases(dossier_liste, mots_audio, id_liste, mots_prevus=()):
    dossier = os.path.join(dossier_liste, "phrases")
    audios = audios_du_dossier(dossier)
    textes = {}
    auto = {}  # False = phrase « pour comprendre » (ligne commencant par *)
    chemin = os.path.join(dossier, "phrases.txt")
    if os.path.isfile(chemin):
        for num, ligne in enumerate(lire_lignes(chemin), 1):
            brut = ligne.strip()
            if not brut or brut.startswith("#"):
                continue
            if "|" not in brut:
                avertissements.append(f"Bloc {id_liste}, phrases.txt ligne {num} : pas de « | » ; ligne ignorée.")
                continue
            lecture_auto = not brut.startswith("*")
            mot, _, phrase = brut.lstrip("*").partition("|")
            textes[mot.strip()] = phrase.strip()
            auto[mot.strip()] = lecture_auto
    resultat = {}
    for mot, fichier in audios.items():
        if mot not in mots_audio:
            if mot not in mots_prevus:  # mot pas encore genere : pas d'avertissement
                avertissements.append(f"Bloc {id_liste} : phrase audio « {fichier} » sans mot correspondant ; ignorée.")
            continue
        resultat[mot] = {"fichier": fichier, "texte": textes.get(mot, ""), "auto": auto.get(mot, True)}
    a_generer = [mot for mot in textes if mot not in audios]
    if a_generer:
        avertissements.append(f"Bloc {id_liste} : {len(a_generer)} phrase(s) écrite(s) dans phrases.txt mais pas encore générée(s) en audio : " + ", ".join(a_generer) + ".")
    return resultat, textes, audios


def lignes_audio_bloc(nom_dossier, id_liste, audios, sans_audio, textes_phrases, audios_phrases):
    """Lignes du CSV pour un bloc : ses mots puis ses phrases."""
    base = f"listes/{nom_dossier}"
    mots = [(m, f"{base}/{f}", "existe") for m, f in audios.items()]
    mots += [(m, f"{base}/{m}.mp3", "manquant") for m in sans_audio if m not in audios]
    lignes = [("mot", id_liste, chemin, m, statut) for m, chemin, statut in sorted(mots, key=lambda x: x[0].casefold())]
    for mot, texte in textes_phrases.items():
        if mot in audios_phrases:
            lignes.append(("phrase", id_liste, f"{base}/phrases/{audios_phrases[mot]}", texte, "existe"))
        else:
            lignes.append(("phrase", id_liste, f"{base}/phrases/{mot}.mp3", texte, "manquant"))
    return lignes


def lignes_audio_consignes(dossier, presentes):
    """Lignes du CSV pour les consignes, d'apres consignes/consignes.txt."""
    chemin = os.path.join(dossier, "consignes.txt")
    if not os.path.isfile(chemin):
        return []
    noms_presents = {f.lower() for f in presentes.values()}
    lignes = []
    for num, ligne in enumerate(lire_lignes(chemin), 1):
        brut = ligne.strip()
        if not brut or brut.startswith("#"):
            continue
        if "|" not in brut:
            avertissements.append(f"consignes.txt ligne {num} : pas de « | » ; ligne ignorée.")
            continue
        fichier, _, texte = brut.partition("|")
        fichier = fichier.strip()
        statut = "existe" if fichier.lower() in noms_presents else "manquant"
        if statut == "manquant":
            avertissements.append(f"Consigne audio absente du dossier consignes : {fichier} (l'app la saute sans rien dire).")
        lignes.append(("consigne", "", f"consignes/{fichier}", texte.strip(), statut))
    return lignes


def ecrire_csv(chemin, lignes):
    """CSV pour Excel : separateur « ; », UTF-8 avec marque d'encodage, fins de ligne Windows."""
    temporaire = chemin + ".tmp"
    try:
        with open(temporaire, "w", encoding="utf-8-sig", newline="") as f:
            ecrivain = csv.writer(f, delimiter=";", lineterminator="\r\n")
            ecrivain.writerow(["type", "bloc", "fichier_a_creer", "texte_a_lire", "statut"])
            ecrivain.writerows(lignes)
        os.replace(temporaire, chemin)
        return True
    except OSError:
        avertissements.append("audio-a-generer.csv n'a pas pu être mis à jour : ferme-le dans Excel, puis relance mettre-a-jour.cmd.")
        try:
            os.remove(temporaire)
        except OSError:
            pass
        return False


def main():
    racine = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    dossier_listes = os.path.join(racine, "listes")
    listes = {}
    lignes_csv = []
    if os.path.isdir(dossier_listes):
        for nom in sorted(os.listdir(dossier_listes), key=cle_naturelle):
            chemin = os.path.join(dossier_listes, nom)
            if not os.path.isdir(chemin) or nom.startswith((".", "_")):
                continue
            id_liste = nfc(nom)
            audios = audios_du_dossier(chemin)
            if not audios and not os.path.isfile(os.path.join(chemin, "bloc.txt")):
                continue
            fiche = lire_bloc_txt(os.path.join(chemin, "bloc.txt"), audios, id_liste)
            phrases, textes_phrases, audios_phrases = lire_phrases(chemin, audios, id_liste, fiche["sansAudio"])
            lignes_csv.extend(lignes_audio_bloc(nom, id_liste, audios, fiche["sansAudio"], textes_phrases, audios_phrases))
            if not audios:
                continue  # liste en preparation : seulement dans le CSV, pas encore dans l'app
            mots = []
            for mot in sorted(audios, key=str.casefold):
                mots.append({
                    "mot": mot,
                    "fichier": audios[mot],
                    "segments": fiche["pieges"].get(mot, [[mot, 0]]),
                    "variantes": fiche["variantes"].get(mot, []),
                    "phrase": phrases.get(mot),
                })
            listes[id_liste] = {
                "id": id_liste,
                "dossier": nom,
                "titreCourt": fiche["titreCourt"],
                "titre": fiche["titre"],
                "description": fiche["description"],
                "mots": mots,
            }
    else:
        avertissements.append(f"Dossier introuvable : {dossier_listes}")

    extras = sorted([i for i in listes if i not in IDS_ATTENDUS], key=cle_naturelle)
    ordre = IDS_ATTENDUS + extras
    consignes = audios_du_dossier(os.path.join(racine, "consignes"))

    donnees = {
        "version": 1,
        "genereLe": datetime.now().isoformat(timespec="seconds"),
        "ordre": ordre,
        "listes": listes,
        "consignes": {os.path.splitext(f)[0]: f for f in consignes.values()},
        "avertissements": avertissements,
    }
    sortie = os.path.join(racine, "app", "donnees.js")
    temporaire = sortie + ".tmp"
    with open(temporaire, "w", encoding="utf-8", newline="\n") as f:
        f.write("// Fichier produit automatiquement par mettre-a-jour.cmd : ne pas modifier.\n")
        f.write("window.DONNEES_QUIZ = ")
        json.dump(donnees, f, ensure_ascii=False, indent=1)
        f.write(";\n")
    os.replace(temporaire, sortie)

    lignes_csv.extend(lignes_audio_consignes(os.path.join(racine, "consignes"), consignes))
    csv_ok = ecrire_csv(os.path.join(racine, "audio-a-generer.csv"), lignes_csv)

    print("Mise a jour terminee.")
    print(f"Listes trouvees : {len(listes)}")
    for id_liste in [i for i in ordre if i in listes]:
        l = listes[id_liste]
        nb_ph = sum(1 for m in l["mots"] if m["phrase"])
        print(f"  Bloc {id_liste} : {len(l['mots'])} mots, {nb_ph} phrases audio")
    print(f"Consignes audio : {len(consignes)}")
    if csv_ok:
        manquants = sum(1 for l in lignes_csv if l[4] == "manquant")
        print(f"Liste des audios : audio-a-generer.csv ({len(lignes_csv)} lignes, dont {manquants} manquant(s))")
    if avertissements:
        print()
        print(f"A VERIFIER ({len(avertissements)}) :")
        for a in avertissements:
            print("  - " + a)
    return 0


if __name__ == "__main__":
    sys.exit(main())
