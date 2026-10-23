import { createApp } from 'vue';
import App from './App.vue';
import * as Battle from './core/battle';
import { battleAvailable, restoreRecords, startCloud } from './cloud';
import { ACCOUNT_TEXT } from './app/account-text';
import { restoreSelection } from './app/state';
import { openBattle } from './app/battle';
import './styles.css';

// Shows the copy of whoever was signed in last, before the first paint
restoreRecords();
restoreSelection();
// The screens are put straight into <body>, as the styles expect
createApp(App).mount(document.body);

if (battleAvailable) {
    const invited = Battle.parseCode(new URLSearchParams(location.search).get('battle') || '');
    if (invited) openBattle(invited);
}

void startCloud({
    // The sync replaced the records: the selection may have changed too
    onData: restoreSelection,
    askMigrate: () => confirm(ACCOUNT_TEXT.askMigrate)
});
