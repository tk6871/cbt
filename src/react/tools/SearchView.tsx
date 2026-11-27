import type { SearchViewModel } from '../../cbt/studyController';
import {clsx as normalizeClass} from 'clsx';
import QuestionLibraryPreview from '../QuestionLibraryPreview';
export function renderSearchView(m: SearchViewModel) {
  const {
    addSearchItemToSchool,
    beginSession,
    bookmarkRoundFilter,
    bookmarkRounds,
    bookmarkedCatalogItems,
    catalogs,
    displayedSearchResults,
    isJewelry,
    newSearchSetTitle,
    normalizedSchoolSubject,
    openView,
    prepareSearchScope,
    requestSearch,
    restoredImageTheme,
    schoolExamData,
    searchBookmarksOnly,
    searchCatalogKeys,
    searchError,
    searchLoading,
    searchQuery,
    searchReady,
    searchScope,
    searchScopeLabel,
    searchSetId,
    searchSubject,
    searchSubjects,
    searchTotal,
  } = m;

  return (
    <>
      <section className="search-command">
        <span>QUESTION FINDER</span>
        <h1>문제·보기·과목을 한 번에 검색</h1>
        <div>
          <b>⌕</b>
          <input
            value={searchQuery}
            onChange={(event) => {
              m.searchQuery = event.currentTarget.value;
              requestSearch();
            }}
            type="search"
            placeholder="예: 냉동사이클, 레이놀즈수, 안전밸브"
            autoFocus={true}
          />
          <small>
            {searchLoading
              ? '출처를 불러오는 중'
              : searchReady
                ? `${searchScopeLabel} 검색 준비 완료`
                : '문제 색인을 준비하는 중'}
          </small>
        </div>
        <section aria-label="통합 검색 범위" className="search-scope-controls">
          <label>
            검색 출처
            <select
              value={searchScope}
              onChange={(event) => {
                m.searchScope = event.currentTarget.value as typeof searchScope;
                prepareSearchScope();
              }}
            >
              <option value="current">현재 종목</option>
              {!isJewelry ? <option value="hvac">공조 + 한솔 공조</option> : null}
              <option value="selected">여러 종목 선택</option>
              <option value="all">전체 종목</option>
            </select>
          </label>
          <label>
            과목
            <select
              value={searchSubject}
              onChange={(event) => {
                m.searchSubject = event.currentTarget.value as typeof searchSubject;
                requestSearch();
              }}
            >
              <option value="all">모든 과목</option>
              {searchSubjects.map((subject) => (
                <option key={subject} value={subject}>
                  {subject}
                </option>
              ))}
            </select>
          </label>
          {searchScope === 'selected' ? (
            <fieldset>
              <legend>함께 검색할 종목</legend>
              {catalogs
                .filter((c) => !c.isVirtual)
                .map((catalog) => (
                  <label key={catalog.key}>
                    <input
                      checked={searchCatalogKeys.includes(catalog.key)}
                      onChange={(event) => {
                        m.searchCatalogKeys = event.currentTarget.checked
                          ? [...searchCatalogKeys, catalog.key]
                          : searchCatalogKeys.filter((key) => key !== catalog.key);
                        prepareSearchScope();
                      }}
                      type="checkbox"
                      value={catalog.key}
                    />
                    {catalog.shortName || catalog.name}
                  </label>
                ))}
            </fieldset>
          ) : null}
          {searchScope === 'all' ? <p>전체 종목 자료를 처음 불러올 때는 시간이 걸릴 수 있습니다.</p> : null}
          {searchError ? (
            <p role="alert">
              {searchError}{' '}
              <button type="button" onClick={prepareSearchScope}>
                다시 불러오기
              </button>
            </p>
          ) : null}
        </section>
        {!isJewelry ? (
          <section aria-label="검색 문제를 담을 시험지" className="search-school-target">
            <label>
              문제를 담을 학교 시험지
              <select
                value={searchSetId}
                onChange={(event) => {
                  m.searchSetId = event.currentTarget.value as typeof searchSetId;
                }}
              >
                <option value="">새 시험지</option>
                {(schoolExamData.questionSets || []).map((set) => (
                  <option key={set.id} value={set.id}>
                    {set.title}
                    {' · '}
                    {set.itemIds.length}
                    문제
                  </option>
                ))}
              </select>
            </label>
            {!searchSetId ? (
              <label>
                시험지 이름
                <input
                  value={newSearchSetTitle}
                  onChange={(event) => {
                    m.newSearchSetTitle = event.currentTarget.value;
                  }}
                  aria-label="새 학교 시험지 이름"
                />
              </label>
            ) : null}
            <button
              type="button"
              onClick={() => {
                openView('school');
              }}
            >
              학교 시험 준비로
            </button>
          </section>
        ) : null}
        <button
          type="button"
          aria-pressed={searchBookmarksOnly}
          onClick={() => {
            m.searchBookmarksOnly = !searchBookmarksOnly;
          }}
          className={normalizeClass(['bookmark-search-toggle', { active: searchBookmarksOnly }])}
        >
          {'★ '}
          {searchBookmarksOnly ? '즐겨찾기만 보는 중' : '즐겨찾기 문제만 보기'}
        </button>
        {searchBookmarksOnly ? (
          <label className="bookmark-round-filter">
            <span>즐겨찾기 회차</span>
            <select
              value={bookmarkRoundFilter}
              onChange={(event) => {
                m.bookmarkRoundFilter = event.currentTarget.value as typeof bookmarkRoundFilter;
              }}
            >
              <option value="all">
                {'전체 회차 · '}
                {bookmarkedCatalogItems.length}
                문제
              </option>
              {bookmarkRounds.map((round) => (
                <option key={round.id} value={round.id}>
                  {round.label}
                  {' · '}
                  {round.count}
                  문제
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </section>
      <div className="search-summary">
        {searchQuery.length < 2 && !searchBookmarksOnly ? (
          <span>두 글자 이상 입력하면 바로 검색됩니다.</span>
        ) : (
          <span>
            <strong>{displayedSearchResults.length}</strong>
            {'개의 '}
            {searchBookmarksOnly ? '즐겨찾기' : '검색'}
            {' 결과'}
            {!searchBookmarksOnly && searchTotal > displayedSearchResults.length ? (
              <>
                {' · 전체 '}
                {searchTotal.toLocaleString()}개 중 먼저 120개 표시
              </>
            ) : null}
          </span>
        )}
      </div>
      {displayedSearchResults.length ? (
        <div className="question-library search-library">
          {displayedSearchResults.map((item) => (
            <article key={item.id}>
              <header>
                <span>
                  {item.round.shortQualification || item.round.qualification}
                  {' · '}
                  {item.round.year}
                  {'년 · '}
                  {normalizedSchoolSubject(item)}
                </span>
                <b>{item.question.number}번</b>
              </header>
              <QuestionLibraryPreview
                item={item}
                text={item.question.text || ''}
                imageTheme={restoredImageTheme}
              />
              <footer>
                <span>{item.round.session || item.round.title}</span>
                <button
                  type="button"
                  onClick={() => {
                    beginSession('learn', `${item.round.year}년 ${item.question.number}번`, [item]);
                  }}
                >
                  문제 열기 →
                </button>
                {!isJewelry ? (
                  <button
                    type="button"
                    onClick={() => {
                      addSearchItemToSchool(item);
                    }}
                  >
                    {schoolExamData.questionSets
                      ?.find((set) => set.id === searchSetId)
                      ?.itemIds.includes(item.id)
                      ? '✓ 시험지에 담음'
                      : '+ 시험지에 담기'}
                  </button>
                ) : null}
              </footer>
            </article>
          ))}
        </div>
      ) : searchBookmarksOnly ? (
        <section className="empty-state">
          <span>★</span>
          <h2>조건에 맞는 즐겨찾기 문제가 없습니다</h2>
          <p>문제의 별표를 눌러 저장하거나 검색어를 지워 보세요.</p>
        </section>
      ) : searchQuery.length >= 2 ? (
        <section className="empty-state">
          <span>⌕</span>
          <h2>일치하는 문제를 찾지 못했습니다</h2>
          <p>검색어를 짧게 줄이거나 다른 용어로 입력해 보세요.</p>
        </section>
      ) : null}
    </>
  );
}
