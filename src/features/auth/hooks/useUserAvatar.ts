import { useCallback, useState } from 'react'
import { supabase } from '@/lib/supabase'

const TIPOS_ACEITOS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
}
const TAMANHO_MAXIMO = 2 * 1024 * 1024 // 2 MB (mesmo limite do bucket)

/** Extrai o caminho do arquivo dentro do bucket a partir da URL pública. */
function caminhoNoBucket(url: string | null | undefined): string | null {
  if (!url) return null
  const marcador = '/avatars/'
  const i = url.indexOf(marcador)
  return i === -1 ? null : decodeURIComponent(url.slice(i + marcador.length).split('?')[0])
}

export function useUserAvatar(userId: string, avatarAtual?: string | null) {
  const [enviado, setEnviado] = useState<string | null>(null)
  const avatar = enviado ?? avatarAtual ?? null

  /** Envia a nova foto. Devolve null em caso de sucesso ou a mensagem de erro. */
  const handleFile = useCallback(
    async (file: File): Promise<string | null> => {
      if (!userId) return 'Faça login novamente para trocar a foto.'

      const extensao = TIPOS_ACEITOS[file.type]
      if (!extensao) return 'Use uma imagem PNG, JPG, WEBP ou GIF.'
      if (file.size > TAMANHO_MAXIMO) return 'A imagem deve ter no máximo 2 MB.'

      // Cada usuário só pode escrever na própria pasta (<id>/...), regra do banco.
      const caminho = `${userId}/${Date.now()}.${extensao}`
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(caminho, file, { contentType: file.type })
      if (uploadError) return 'Não foi possível enviar a foto.'

      const { data } = supabase.storage.from('avatars').getPublicUrl(caminho)
      const url = data.publicUrl

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: url })
        .eq('id', userId)

      if (updateError) {
        await supabase.storage.from('avatars').remove([caminho])
        return 'Não foi possível salvar a foto no seu perfil.'
      }

      // Apaga a foto anterior para não acumular arquivos órfãos (só dentro da própria pasta).
      const anterior = caminhoNoBucket(avatarAtual)
      if (anterior && anterior.startsWith(`${userId}/`)) {
        await supabase.storage.from('avatars').remove([anterior])
      }

      setEnviado(url)
      return null
    },
    [userId, avatarAtual],
  )

  return { avatar, handleFile }
}
