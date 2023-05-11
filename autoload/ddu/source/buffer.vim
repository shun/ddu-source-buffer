function! ddu#source#buffer#getbufinfo() abort
  return {
  \  'currentDir': getcwd(),
  \  'alternateBufNr': bufnr('#'),
  \  'buffers': map(getbufinfo(), {_, buf -> {
  \    'bufnr': buf['bufnr'],
  \    'changed': buf['changed'],
  \    'lastused': buf['lastused'],
  \    'listed': buf['listed'],
  \    'name': buf['name'],
  \  }}),
  \  'termList': s:termList(),
  \}
endfunction

if exists('*term_list')
  function! s:termList() abort
    return term_list()
  endfunction
else
  function! s:termList() abort
    return []
  endfunction
endif
