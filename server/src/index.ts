import './env'
import { createApp } from './app'
import { config } from './config'
import { startCloverOrderImportPoller } from './services/cloverOrderImport'
import { startCloverReconciliationPoller } from './services/cloverReconcile'

const app = createApp()

app.listen(config.port, () => {
  console.log(`deccan-bawarchi-api listening on port ${config.port}`)
})

startCloverReconciliationPoller()
startCloverOrderImportPoller()
